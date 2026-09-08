export type ModelType = 'fraud_detection' | 'service_prioritisation';

export type ScenarioType = 'stable' | 'drifted' | 'missing_data' | 'noisy_data';

export type AlertSeverity = 'GREEN' | 'AMBER' | 'RED';

export interface Observation {
  id: string;
  transaction_amount: number | null;
  transaction_frequency: number;
  account_age_days: number;
  customer_risk_score: number;
  login_frequency: number;
  device_risk_score: number;
  geographic_risk_score: number;
  previous_fraud_count: number;
  service_request_frequency: number;
  model_prediction: number; // 0 or 1
  prediction_probability: number; // 0.0 - 1.0
  timestamp: string;
  model_name: string;
  monitoring_period: 'baseline' | 'current';
}

export type FeatureName = 
  | 'transaction_amount'
  | 'transaction_frequency'
  | 'account_age_days'
  | 'customer_risk_score'
  | 'login_frequency'
  | 'device_risk_score'
  | 'geographic_risk_score'
  | 'previous_fraud_count'
  | 'service_request_frequency';

export interface FeatureStats {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  missingCount: number;
  missingPercentage: number;
}

export interface BinDistribution {
  binMin: number;
  binMax: number;
  label: string;
  baselineRatio: number;
  currentRatio: number;
  baselineCount: number;
  currentCount: number;
  psiContribution: number;
}

export interface DriftMetric {
  featureName: FeatureName;
  displayName: string;
  baselineStats: FeatureStats;
  currentStats: FeatureStats;
  meanPercentChange: number;
  medianPercentChange: number;
  stdDevPercentChange: number;
  psiScore: number;
  ksStatistic: number;
  ksPValue: number;
  status: AlertSeverity;
  bins: BinDistribution[];
}

export interface ThresholdConfig {
  psiWarning: number;   // default 0.10
  psiCritical: number;  // default 0.20
  ksPValueThreshold: number; // default 0.05
  predictionRateWarningDelta: number; // default 0.05 (5% change)
}

export interface PredictionMetrics {
  baselinePositiveRate: number; // % (e.g. 0.082 = 8.2%)
  currentPositiveRate: number;  // % (e.g. 0.147 = 14.7%)
  rateChangePercent: number;
  baselineAvgProb: number;
  currentAvgProb: number;
  probabilityPsi: number;
  status: AlertSeverity;
  probBins: BinDistribution[];
}

export interface AlertDetail {
  id: string;
  severity: AlertSeverity;
  title: string;
  triggerReason: string;
  affectedFeatures: FeatureName[];
  driftStatistic: string;
  configuredThreshold: string;
  observedValue: string;
  monitoringPeriod: string;
  suggestedAction: string;
  timestamp: string;
}

export interface MonitoringResult {
  modelType: ModelType;
  modelDisplayName: string;
  scenario: ScenarioType;
  scenarioDisplayName: string;
  baselineCount: number;
  currentCount: number;
  overallStatus: AlertSeverity;
  featuresMonitored: number;
  featuresWithDrift: number;
  featuresWithWarning: number;
  driftMetrics: DriftMetric[];
  predictionMetrics: PredictionMetrics;
  alerts: AlertDetail[];
  executionTimeMs: number;
  lastMonitoringRun: string;
  thresholds: ThresholdConfig;
  missingnessWarning?: string;
  outlierWarning?: string;
}

export interface TestCaseResult {
  id: string;
  name: string;
  description: string;
  expectedStatus: AlertSeverity;
  actualStatus: AlertSeverity;
  passed: boolean;
  details: string;
  logs: string[];
}

export interface StakeholderFeedback {
  id: string;
  role: string;
  problemClear: boolean;
  alertUnderstandable: boolean;
  featureIdentified: boolean;
  helpfulForDecision: boolean;
  comments: string;
  timestamp: string;
  isSynthetic: boolean;
}
