import {
  Observation,
  FeatureName,
  ModelType,
  ScenarioType,
  ThresholdConfig,
  MonitoringResult,
  DriftMetric,
  PredictionMetrics,
  AlertDetail,
  AlertSeverity
} from '../types/monitoring';
import { calculateFeatureStats, calculatePSI, calculateKS } from './statistics';
import { applyEdgeCaseScenario } from './edgeCases';

const FEATURE_DISPLAY_NAMES: Record<FeatureName, string> = {
  transaction_amount: 'Transaction Amount ($)',
  transaction_frequency: 'Transaction Frequency (Monthly)',
  account_age_days: 'Account Age (Days)',
  customer_risk_score: 'Customer Risk Score (0-100)',
  login_frequency: 'Login Frequency (Weekly)',
  device_risk_score: 'Device Risk Score (0-1)',
  geographic_risk_score: 'Geographic Risk Score (0-1)',
  previous_fraud_count: 'Previous Fraud Count',
  service_request_frequency: 'Service Request Frequency'
};

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  psiWarning: 0.10,
  psiCritical: 0.20,
  ksPValueThreshold: 0.05,
  predictionRateWarningDelta: 0.05 // 5 percentage points
};

export function runDriftAnalysis(
  baseline: Observation[],
  rawCurrent: Observation[],
  modelType: ModelType,
  scenario: ScenarioType,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): MonitoringResult {
  const startTime = performance.now();

  const { processedObservations: current, missingnessWarning, outlierWarning } = applyEdgeCaseScenario(rawCurrent, scenario);

  const features: FeatureName[] = [
    'transaction_amount',
    'transaction_frequency',
    'account_age_days',
    'customer_risk_score',
    'login_frequency',
    'device_risk_score',
    'geographic_risk_score',
    'previous_fraud_count',
    'service_request_frequency'
  ];

  const driftMetrics: DriftMetric[] = [];
  let featuresWithDrift = 0; // RED
  let featuresWithWarning = 0; // AMBER
  const alerts: AlertDetail[] = [];

  for (const feature of features) {
    const baselineVals = baseline.map(o => o[feature]);
    const currentVals = current.map(o => o[feature]);

    const bStats = calculateFeatureStats(baselineVals);
    const cStats = calculateFeatureStats(currentVals);

    const meanPercentChange = bStats.mean !== 0 ? ((cStats.mean - bStats.mean) / Math.abs(bStats.mean)) * 100 : 0;
    const medianPercentChange = bStats.median !== 0 ? ((cStats.median - bStats.median) / Math.abs(bStats.median)) * 100 : 0;
    const stdDevPercentChange = bStats.stdDev !== 0 ? ((cStats.stdDev - bStats.stdDev) / Math.abs(bStats.stdDev)) * 100 : 0;

    const { psiScore, bins } = calculatePSI(baselineVals, currentVals, 10);
    const { ksStatistic, pValue } = calculateKS(baselineVals, currentVals);

    let status: AlertSeverity = 'GREEN';
    // Requires both statistical significance (p < alpha) and minimum empirical CDF distance (D >= 0.08)
    const isKsSignificantShift = pValue < thresholds.ksPValueThreshold && ksStatistic >= 0.08;

    if (psiScore >= thresholds.psiCritical) {
      status = 'RED';
      featuresWithDrift++;
    } else if (psiScore >= thresholds.psiWarning || isKsSignificantShift) {
      status = 'AMBER';
      featuresWithWarning++;
    }

    driftMetrics.push({
      featureName: feature,
      displayName: FEATURE_DISPLAY_NAMES[feature],
      baselineStats: bStats,
      currentStats: cStats,
      meanPercentChange,
      medianPercentChange,
      stdDevPercentChange,
      psiScore,
      ksStatistic,
      ksPValue: pValue,
      status,
      bins
    });

    if (status === 'RED') {
      alerts.push({
        id: `alert_feature_${feature}_${Date.now()}`,
        severity: 'RED',
        title: `Significant Distribution Drift in ${FEATURE_DISPLAY_NAMES[feature]}`,
        triggerReason: `PSI statistic reached ${psiScore.toFixed(3)}, exceeding the configured critical threshold of ${thresholds.psiCritical.toFixed(2)}.`,
        affectedFeatures: [feature],
        driftStatistic: `PSI: ${psiScore.toFixed(3)} | KS p-value: ${pValue < 0.001 ? '<0.001' : pValue.toFixed(4)}`,
        configuredThreshold: `PSI >= ${thresholds.psiCritical.toFixed(2)}`,
        observedValue: `PSI = ${psiScore.toFixed(3)}`,
        monitoringPeriod: 'Current vs Baseline',
        suggestedAction: 'RECOMMEND MODEL REVIEW: Perform feature importance analysis, evaluate recent input pipeline shifts, and consult model governance team before retraining.',
        timestamp: new Date().toISOString()
      });
    } else if (status === 'AMBER') {
      alerts.push({
        id: `alert_feature_${feature}_${Date.now()}`,
        severity: 'AMBER',
        title: `Moderate Distribution Shift in ${FEATURE_DISPLAY_NAMES[feature]}`,
        triggerReason: `Statistical test indicated distribution drift (PSI: ${psiScore.toFixed(3)}, KS D: ${ksStatistic.toFixed(3)}, p-value: ${pValue < 0.001 ? '<0.001' : pValue.toFixed(4)}).`,
        affectedFeatures: [feature],
        driftStatistic: `PSI: ${psiScore.toFixed(3)} | KS D: ${ksStatistic.toFixed(3)}`,
        configuredThreshold: `PSI >= ${thresholds.psiWarning.toFixed(2)} or KS D >= 0.08`,
        observedValue: `PSI = ${psiScore.toFixed(3)}`,
        monitoringPeriod: 'Current vs Baseline',
        suggestedAction: 'MONITOR CLOSELY: Feature shows early signs of population shift. Schedule follow-up check in next monitoring window.',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Evaluate Prediction Monitoring
  const baselineProbs = baseline.map(o => o.prediction_probability);
  const currentProbs = current.map(o => o.prediction_probability);

  const bPosCount = baseline.filter(o => o.model_prediction === 1).length;
  const cPosCount = current.filter(o => o.model_prediction === 1).length;

  const baselinePositiveRate = (bPosCount / baseline.length) * 100;
  const currentPositiveRate = (cPosCount / current.length) * 100;
  const rateChangePercent = currentPositiveRate - baselinePositiveRate;

  const bStatsProb = calculateFeatureStats(baselineProbs);
  const cStatsProb = calculateFeatureStats(currentProbs);

  const { psiScore: probPsi, bins: probBins } = calculatePSI(baselineProbs, currentProbs, 10);

  let predictionStatus: AlertSeverity = 'GREEN';
  if (Math.abs(rateChangePercent) / 100 >= thresholds.predictionRateWarningDelta || probPsi >= thresholds.psiCritical) {
    predictionStatus = 'RED';
  } else if (probPsi >= thresholds.psiWarning) {
    predictionStatus = 'AMBER';
  }

  const predictionMetrics: PredictionMetrics = {
    baselinePositiveRate,
    currentPositiveRate,
    rateChangePercent,
    baselineAvgProb: bStatsProb.mean,
    currentAvgProb: cStatsProb.mean,
    probabilityPsi: probPsi,
    status: predictionStatus,
    probBins
  };

  if (predictionStatus === 'RED') {
    alerts.push({
      id: `alert_prediction_${Date.now()}`,
      severity: 'RED',
      title: 'Model Prediction Rate Anomaly Detected',
      triggerReason: `Positive prediction rate changed from ${baselinePositiveRate.toFixed(1)}% to ${currentPositiveRate.toFixed(1)}% (${rateChangePercent > 0 ? '+' : ''}${rateChangePercent.toFixed(1)}% shift), exceeding the ${thresholds.predictionRateWarningDelta * 100}% threshold.`,
      affectedFeatures: [],
      driftStatistic: `Prediction Probability PSI: ${probPsi.toFixed(3)}`,
      configuredThreshold: `Rate Shift >= ${thresholds.predictionRateWarningDelta * 100}%`,
      observedValue: `Observed Rate Shift = ${rateChangePercent.toFixed(1)}%`,
      monitoringPeriod: 'Current vs Baseline',
      suggestedAction: 'Prediction-level monitoring trigger. Significant output probability shift detected. Initiate risk review for downstream decision pipelines.',
      timestamp: new Date().toISOString()
    });
  }

  // Determine overall system health status
  let overallStatus: AlertSeverity = 'GREEN';
  if (featuresWithDrift > 0 || predictionStatus === 'RED') {
    overallStatus = 'RED';
  } else if (featuresWithWarning > 0 || predictionStatus === 'AMBER') {
    overallStatus = 'AMBER';
  }

  const endTime = performance.now();

  const scenarioNames: Record<ScenarioType, string> = {
    stable: 'Scenario A — Stable Baseline Match',
    drifted: 'Scenario B — Multi-Feature Shifted Drift',
    missing_data: 'Test Case 1 — Missing Observations (18%)',
    noisy_data: 'Test Case 2 — Extreme Outliers & Noise'
  };

  return {
    modelType,
    modelDisplayName: modelType === 'fraud_detection' ? 'Fraud Detection Model v2.4' : 'Service Prioritisation Model v1.8',
    scenario,
    scenarioDisplayName: scenarioNames[scenario],
    baselineCount: baseline.length,
    currentCount: current.length,
    overallStatus,
    featuresMonitored: features.length,
    featuresWithDrift,
    featuresWithWarning,
    driftMetrics,
    predictionMetrics,
    alerts,
    executionTimeMs: Math.round(endTime - startTime),
    lastMonitoringRun: new Date().toLocaleTimeString() + ' (' + new Date().toISOString().slice(0, 10) + ')',
    thresholds,
    missingnessWarning,
    outlierWarning
  };
}
