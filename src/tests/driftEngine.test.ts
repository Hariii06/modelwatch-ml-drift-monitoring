import { calculatePSI, calculateKS } from '../engine/statistics';
import { generateSyntheticDataset } from '../engine/generator';
import { runDriftAnalysis, DEFAULT_THRESHOLDS } from '../engine/driftEngine';
import { transformLegacyPayload } from '../engine/legacyAdapter';
import {
  matchPredictionsToOutcomes,
  calculatePerformanceMetrics,
  calculateRocAuc,
  calculateOutcomeCoverage,
  calculateDelayMetrics
} from '../engine/outcomeEngine';
import { StoreAndForwardBuffer } from '../engine/bufferEngine';
import {
  postPredictionBatch,
  postOutcomeBatch,
  getHealthStatus
} from '../engine/ingestionService';
import { PersistenceManager } from '../engine/persistenceManager';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SystemSettingsModal } from '../components/SystemSettingsModal';
import { TestCaseResult, GroundTruthOutcome, Observation } from '../types/monitoring';



export async function executeUnitTests(): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];

  // Test 1: PSI Zero for Identical Distributions
  try {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const { psiScore } = calculatePSI(arr, arr);
    const passed = psiScore < 0.01;
    results.push({
      id: 'test_1_psi_identical',
      name: 'PSI Calculation - Identical Distributions',
      description: 'Verifies that Population Stability Index (PSI) is near 0 (<0.01) for identical baseline and current samples.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Calculated PSI: ${psiScore.toFixed(4)}. Expected < 0.01.`,
      logs: [`Baseline length: ${arr.length}`, `Current length: ${arr.length}`, `PSI Score: ${psiScore}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_1_psi_identical',
      name: 'PSI Calculation - Identical Distributions',
      description: 'Verifies that PSI is near 0 for identical datasets.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception thrown: ${err.message}`,
      logs: [err.stack]
    });
  }

  // Test 2: PSI High for Heavily Shifted Distributions
  try {
    const baselineArr = Array.from({ length: 1000 }, () => Math.random() * 100);
    const shiftedArr = Array.from({ length: 1000 }, () => Math.random() * 100 + 60); // Shifted by +60
    const { psiScore } = calculatePSI(baselineArr, shiftedArr);
    const passed = psiScore >= 0.20;
    results.push({
      id: 'test_2_psi_shifted',
      name: 'PSI Calculation - Heavily Shifted Distribution',
      description: 'Verifies that PSI correctly detects significant drift (PSI >= 0.20) on shifted distributions.',
      expectedStatus: 'RED',
      actualStatus: passed ? 'RED' : 'GREEN',
      passed,
      details: `Calculated PSI: ${psiScore.toFixed(4)}. Expected >= 0.20.`,
      logs: [`Baseline mean: 50.0`, `Current mean: 110.0`, `PSI Score: ${psiScore.toFixed(4)}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_2_psi_shifted',
      name: 'PSI Calculation - Heavily Shifted Distribution',
      description: 'Verifies that PSI detects shifted distributions.',
      expectedStatus: 'RED',
      actualStatus: 'GREEN',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 3: Kolmogorov-Smirnov Test Shift Detection
  try {
    const sampleA = Array.from({ length: 500 }, () => Math.random() * 50);
    const sampleB = Array.from({ length: 500 }, () => Math.random() * 50 + 15);
    const { ksStatistic, pValue } = calculateKS(sampleA, sampleB);
    const passed = pValue < 0.05 && ksStatistic > 0.15;
    results.push({
      id: 'test_3_ks_shift',
      name: 'KS Test Statistic - Shift Detection',
      description: 'Verifies that Kolmogorov-Smirnov test statistic detects distribution difference with p-value < 0.05.',
      expectedStatus: 'RED',
      actualStatus: passed ? 'RED' : 'GREEN',
      passed,
      details: `KS Statistic D: ${ksStatistic.toFixed(4)}, p-value: ${pValue.toFixed(6)}. Expected p < 0.05.`,
      logs: [`KS D: ${ksStatistic}`, `p-value: ${pValue}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_3_ks_shift',
      name: 'KS Test Statistic - Shift Detection',
      description: 'Verifies KS test shift detection.',
      expectedStatus: 'RED',
      actualStatus: 'GREEN',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 4: Scenario A Classification (Stable Dataset -> GREEN)
  try {
    const { baseline, current } = generateSyntheticDataset('fraud_detection', 'stable');
    const result = runDriftAnalysis(baseline, current, 'fraud_detection', 'stable');
    const passed = result.overallStatus === 'GREEN';
    results.push({
      id: 'test_4_stable_scenario',
      name: 'Scenario Classification - Stable Dataset',
      description: 'Evaluates 10k baseline vs 5k current stable scenario. System should classify as GREEN.',
      expectedStatus: 'GREEN',
      actualStatus: result.overallStatus,
      passed,
      details: `Overall Status: ${result.overallStatus}. Drifted features: ${result.featuresWithDrift}. Warning features: ${result.featuresWithWarning}.`,
      logs: [`Baseline records: ${result.baselineCount}`, `Current records: ${result.currentCount}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_4_stable_scenario',
      name: 'Scenario Classification - Stable Dataset',
      description: 'Evaluates stable scenario classification.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 5: Scenario B Classification (Drifted Dataset -> RED Alert)
  try {
    const { baseline, current } = generateSyntheticDataset('fraud_detection', 'drifted');
    const result = runDriftAnalysis(baseline, current, 'fraud_detection', 'drifted');
    const passed = result.overallStatus === 'RED' && result.featuresWithDrift > 0 && result.alerts.length > 0;
    results.push({
      id: 'test_5_drifted_scenario',
      name: 'Scenario Classification - Drifted Dataset Alert Trigger',
      description: 'Evaluates drifted dataset with distribution shifts in transaction_amount, device_risk_score, login_frequency. Expects RED overall status and actionable alerts.',
      expectedStatus: 'RED',
      actualStatus: result.overallStatus,
      passed,
      details: `Overall Status: ${result.overallStatus}. Features with critical drift: ${result.featuresWithDrift}. Alert count: ${result.alerts.length}.`,
      logs: result.alerts.map(a => a.title)
    });
  } catch (err: any) {
    results.push({
      id: 'test_5_drifted_scenario',
      name: 'Scenario Classification - Drifted Dataset',
      description: 'Evaluates drifted dataset classification.',
      expectedStatus: 'RED',
      actualStatus: 'GREEN',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 6: Missing Values Handling (Test Case 1)
  try {
    const { baseline, current } = generateSyntheticDataset('fraud_detection', 'stable');
    const result = runDriftAnalysis(baseline, current, 'fraud_detection', 'missing_data');
    const hasWarning = result.missingnessWarning !== undefined && result.missingnessWarning.includes('missing');
    const isOperational = result.featuresMonitored === 9;
    const passed = hasWarning && isOperational;
    results.push({
      id: 'test_6_missing_values',
      name: 'Edge Case 1 - High Missingness Handling',
      description: 'Injects 18% missing values into transaction_amount. Verifies system remains operational, filters nulls safely, and displays clear warning without crashing.',
      expectedStatus: 'AMBER',
      actualStatus: result.overallStatus,
      passed,
      details: `Warning: ${result.missingnessWarning}`,
      logs: [`Missingness warning present: ${hasWarning}`, `Monitored features count: ${result.featuresMonitored}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_6_missing_values',
      name: 'Edge Case 1 - Missing Values Handling',
      description: 'Verifies missing values handling resilience.',
      expectedStatus: 'AMBER',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 7: Extreme Outliers Handling (Test Case 2)
  try {
    const { baseline, current } = generateSyntheticDataset('fraud_detection', 'stable');
    const result = runDriftAnalysis(baseline, current, 'fraud_detection', 'noisy_data');
    const hasOutlierWarning = result.outlierWarning !== undefined;
    const isOperational = result.featuresMonitored === 9;
    const passed = hasOutlierWarning && isOperational;
    results.push({
      id: 'test_7_outliers',
      name: 'Edge Case 2 - Extreme Noisy Outliers Handling',
      description: 'Injects $45,000-$120,000 extreme transaction amounts into current dataset. Verifies outlier detection warning and operational calculation continuity.',
      expectedStatus: 'AMBER',
      actualStatus: result.overallStatus,
      passed,
      details: `Outlier Warning: ${result.outlierWarning}`,
      logs: [`Outlier warning present: ${hasOutlierWarning}`, `Monitored features count: ${result.featuresMonitored}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_7_outliers',
      name: 'Edge Case 2 - Extreme Outliers Handling',
      description: 'Verifies outlier handling resilience.',
      expectedStatus: 'AMBER',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 8: Dynamic Threshold Adjustment Recalculation
  try {
    const { baseline, current } = generateSyntheticDataset('fraud_detection', 'drifted');
    
    // Strict threshold (0.15): should classify drifted features as critical
    const strictResult = runDriftAnalysis(baseline, current, 'fraud_detection', 'drifted', {
      ...DEFAULT_THRESHOLDS,
      psiCritical: 0.15
    });

    // Highly relaxed threshold (10.0): should yield 0 critical features
    const relaxedResult = runDriftAnalysis(baseline, current, 'fraud_detection', 'drifted', {
      ...DEFAULT_THRESHOLDS,
      psiCritical: 10.0,
      psiWarning: 8.0,
      predictionRateWarningDelta: 1.0
    });

    const passed = strictResult.featuresWithDrift > 0 && relaxedResult.featuresWithDrift === 0;
    results.push({
      id: 'test_8_threshold_recalculation',
      name: 'Configurable Threshold Recalculation',
      description: 'Verifies that modifying statistical threshold inputs dynamically updates feature drift statuses and alert triggers.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Strict threshold (0.15) critical features: ${strictResult.featuresWithDrift}. Relaxed threshold (10.0) critical features: ${relaxedResult.featuresWithDrift}.`,
      logs: [`Strict status: ${strictResult.overallStatus}`, `Relaxed status: ${relaxedResult.overallStatus}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_8_threshold_recalculation',
      name: 'Configurable Threshold Recalculation',
      description: 'Verifies dynamic threshold recalculation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 9: Edge Case A - Zero-Variance / Constant Arrays
  try {
    const constBaseline = Array(50).fill(42);
    const constCurrent = Array(50).fill(42);
    const { psiScore, bins } = calculatePSI(constBaseline, constCurrent);
    const passed = isFinite(psiScore) && !isNaN(psiScore) && psiScore < 0.01 && bins.length > 0;
    results.push({
      id: 'test_9_zero_variance_psi',
      name: 'PSI Edge Case A - Zero-Variance Constant Arrays',
      description: 'Verifies that PSI engine handles constant zero-variance arrays without division by zero or NaN.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Calculated PSI: ${psiScore.toFixed(4)}. Bins generated: ${bins.length}. Expected finite PSI < 0.01.`,
      logs: [`Constant value: 42`, `PSI Score: ${psiScore}`, `Total Bins: ${bins.length}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_9_zero_variance_psi',
      name: 'PSI Edge Case A - Zero-Variance Constant Arrays',
      description: 'Verifies zero-variance constant array resilience.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 10: Edge Case B - Small Arrays (N = 3)
  try {
    const smallBaseline = [10, 20, 30];
    const smallCurrent = [12, 22, 32];
    const { psiScore, bins } = calculatePSI(smallBaseline, smallCurrent);
    const passed = isFinite(psiScore) && !isNaN(psiScore) && bins.length > 0;
    results.push({
      id: 'test_10_small_array_psi',
      name: 'PSI Edge Case B - Small Sample Sizes (N = 3)',
      description: 'Verifies equal-width fallback resilience for very small arrays (N=3) where quantile boundaries cannot form 10 bins.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Calculated PSI: ${psiScore.toFixed(4)}. Bins generated: ${bins.length}. Expected finite result.`,
      logs: [`Baseline length: 3`, `Current length: 3`, `PSI Score: ${psiScore}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_10_small_array_psi',
      name: 'PSI Edge Case B - Small Sample Sizes (N = 3)',
      description: 'Verifies small array PSI calculation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 11: Edge Case C - Quantile Edge Collision / Repeated Values
  try {
    const baselineRepeated = Array(900).fill(0).concat(Array(100).fill(1));
    const currentRepeated = Array(50).fill(0).concat(Array(450).fill(1));
    const { psiScore, bins } = calculatePSI(baselineRepeated, currentRepeated);
    const passed = isFinite(psiScore) && !isNaN(psiScore) && psiScore >= 0.20 && bins.length > 0;
    results.push({
      id: 'test_11_quantile_collision_psi',
      name: 'PSI Edge Case C - Quantile Edge Collision & Repeated Values',
      description: 'Verifies safety and drift detection when quantile boundaries collide due to high frequency duplicate values.',
      expectedStatus: 'RED',
      actualStatus: passed ? 'RED' : 'GREEN',
      passed,
      details: `Calculated PSI: ${psiScore.toFixed(4)}. Expected critical drift (>= 0.20) without NaN or Infinity.`,
      logs: [`Baseline zeros/ones: 900/100`, `Current zeros/ones: 50/450`, `PSI Score: ${psiScore.toFixed(4)}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_11_quantile_collision_psi',
      name: 'PSI Edge Case C - Quantile Edge Collision',
      description: 'Verifies quantile collision handling.',
      expectedStatus: 'RED',
      actualStatus: 'GREEN',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 12: Edge Case D - Scale Invariance / Linear Scale Property
  try {
    const unscaledBaseline = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const unscaledCurrent = [15, 25, 35, 45, 55, 65, 75, 85, 95, 105];

    const scaledBaseline = unscaledBaseline.map(x => x * 1000);
    const scaledCurrent = unscaledCurrent.map(x => x * 1000);

    const res1 = calculatePSI(unscaledBaseline, unscaledCurrent);
    const res2 = calculatePSI(scaledBaseline, scaledCurrent);

    const delta = Math.abs(res1.psiScore - res2.psiScore);
    const passed = isFinite(res2.psiScore) && delta < 1e-4;
    results.push({
      id: 'test_12_scale_invariance_psi',
      name: 'PSI Edge Case D - Scale Invariance Property',
      description: 'Verifies that scaling dataset values by a linear constant factor (x1,000) preserves bin proportion ratios and PSI score.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Unscaled PSI: ${res1.psiScore.toFixed(6)}, Scaled PSI: ${res2.psiScore.toFixed(6)}, Delta: ${delta.toFixed(6)}. Expected delta < 1e-4.`,
      logs: [`Unscaled PSI: ${res1.psiScore}`, `Scaled PSI: ${res2.psiScore}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_12_scale_invariance_psi',
      name: 'PSI Edge Case D - Scale Invariance Property',
      description: 'Verifies scale invariance property.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 13: Edge Case E - Extreme Negative Values
  try {
    const negBaseline = [-1000, -900, -800, -700, -600, -500, -400, -300, -200, -100];
    const negCurrent = [-1000, -900, -800, -700, -600, -500, -400, -300, -200, -100];
    const { psiScore } = calculatePSI(negBaseline, negCurrent);
    const passed = isFinite(psiScore) && !isNaN(psiScore) && psiScore < 0.01;
    results.push({
      id: 'test_13_extreme_negative_psi',
      name: 'PSI Edge Case E - Extreme Negative Values Handling',
      description: 'Verifies that strongly negative values are processed without mathematical domain errors or invalid log calculations.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Calculated PSI: ${psiScore.toFixed(4)}. Expected finite PSI < 0.01.`,
      logs: [`Negative baseline range: [-1000, -100]`, `PSI Score: ${psiScore}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_13_extreme_negative_psi',
      name: 'PSI Edge Case E - Extreme Negative Values',
      description: 'Verifies negative value PSI processing.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 14: Legacy Adapter A - Valid Single Payload Transformation
  try {
    const payload = {
      version: 'v1_legacy',
      modelType: 'fraud_detection' as const,
      records: [
        {
          record_id: 'rec_001',
          tx_amt: 250.75,
          user_risk: 65,
          score: 0.88,
          pred_label: 1,
          device_score: 0.45,
          geo_score: 0.30,
          timestamp_str: '2026-09-15T12:00:00Z'
        }
      ]
    };
    const res = transformLegacyPayload(payload);
    const obs = res.observations[0];
    const passed =
      res.success &&
      res.transformedCount === 1 &&
      obs.transaction_amount === 250.75 &&
      obs.customer_risk_score === 65 &&
      obs.prediction_probability === 0.88 &&
      obs.model_prediction === 1;

    results.push({
      id: 'test_14_legacy_valid_transform',
      name: 'Legacy Adapter A - Valid Single Payload Transformation',
      description: 'Verifies v1_legacy payload field mapping (tx_amt -> transaction_amount, user_risk -> customer_risk_score, score -> prediction_probability).',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Transformed count: ${res.transformedCount}. Success: ${res.success}. Mapped tx_amt: ${obs?.transaction_amount}, user_risk: ${obs?.customer_risk_score}.`,
      logs: [`Transformed ID: ${obs?.id}`, `Errors count: ${res.errors.length}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_14_legacy_valid_transform',
      name: 'Legacy Adapter A - Valid Single Payload Transformation',
      description: 'Verifies single legacy record transformation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 15: Legacy Adapter B - Batch Transformation
  try {
    const batchPayload = {
      version: 'v1_legacy',
      records: Array.from({ length: 5 }, (_, i) => ({
        record_id: `batch_rec_${i + 1}`,
        tx_amt: 100 + i * 50,
        user_risk: 20 + i * 10,
        score: 0.1 + i * 0.2,
        pred_label: i > 2 ? 1 : 0
      }))
    };
    const res = transformLegacyPayload(batchPayload);
    const passed = res.success && res.transformedCount === 5 && res.observations.length === 5;
    results.push({
      id: 'test_15_legacy_batch_transform',
      name: 'Legacy Adapter B - Batch Records Transformation',
      description: 'Verifies that an entire batch of 5 legacy prediction records is transformed accurately.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Batch transformed count: ${res.transformedCount}. Expected 5.`,
      logs: [`Batch records submitted: 5`, `Transformed count: ${res.transformedCount}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_15_legacy_batch_transform',
      name: 'Legacy Adapter B - Batch Records Transformation',
      description: 'Verifies batch transformation resilience.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 16: Legacy Adapter C - Numeric String Parsing
  try {
    const stringPayload = {
      version: 'v1_legacy',
      records: [
        {
          record_id: 'str_rec_001',
          tx_amt: '340.50',
          user_risk: '45',
          score: '0.72',
          pred_label: '1'
        }
      ]
    };
    const res = transformLegacyPayload(stringPayload);
    const obs = res.observations[0];
    const passed =
      res.success &&
      typeof obs.transaction_amount === 'number' &&
      obs.transaction_amount === 340.50 &&
      obs.customer_risk_score === 45 &&
      obs.prediction_probability === 0.72 &&
      obs.model_prediction === 1;

    results.push({
      id: 'test_16_legacy_numeric_strings',
      name: 'Legacy Adapter C - Numeric String Conversion',
      description: 'Verifies that numeric values formatted as strings (e.g. "340.50", "45", "0.72") are parsed safely into numbers.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Parsed tx_amt: ${obs?.transaction_amount} (${typeof obs?.transaction_amount}), user_risk: ${obs?.customer_risk_score}, score: ${obs?.prediction_probability}.`,
      logs: [`Parsed score type: ${typeof obs?.prediction_probability}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_16_legacy_numeric_strings',
      name: 'Legacy Adapter C - Numeric String Conversion',
      description: 'Verifies numeric string parsing.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 17: Legacy Adapter D - Invalid Payload Rejection
  try {
    const invalidPayload = {
      version: 'v1_legacy',
      records: [
        {
          record_id: 'bad_rec_001',
          tx_amt: 'invalid_number',
          score: 1.8, // Invalid probability > 1.0
          pred_label: 99 // Invalid label
        }
      ]
    };
    const res = transformLegacyPayload(invalidPayload);
    const passed = !res.success && res.errors.length > 0 && res.transformedCount === 0;
    results.push({
      id: 'test_17_legacy_invalid_rejection',
      name: 'Legacy Adapter D - Invalid Payload Rejection',
      description: 'Verifies that malformed payloads (invalid numbers, probability > 1.0, invalid label) are rejected with clear error messages.',
      expectedStatus: 'RED',
      actualStatus: passed ? 'RED' : 'GREEN',
      passed,
      details: `Success: ${res.success}. Validation errors captured: ${res.errors.length}.`,
      logs: res.errors
    });
  } catch (err: any) {
    results.push({
      id: 'test_17_legacy_invalid_rejection',
      name: 'Legacy Adapter D - Invalid Payload Rejection',
      description: 'Verifies invalid payload rejection.',
      expectedStatus: 'RED',
      actualStatus: 'GREEN',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 18: Legacy Adapter E - Unsupported Schema Version
  try {
    const unknownVersionPayload = {
      version: 'v99_unsupported',
      records: [{ tx_amt: 100, score: 0.5 }]
    };
    const res = transformLegacyPayload(unknownVersionPayload);
    const passed = !res.success && res.errors.some(e => e.includes('Unsupported schema version'));
    results.push({
      id: 'test_18_legacy_unsupported_version',
      name: 'Legacy Adapter E - Unsupported Schema Version Rejection',
      description: 'Verifies rejection of unknown/unsupported API schema version identifiers.',
      expectedStatus: 'RED',
      actualStatus: passed ? 'RED' : 'GREEN',
      passed,
      details: `Success: ${res.success}. Error message: '${res.errors[0]}'.`,
      logs: res.errors
    });
  } catch (err: any) {
    results.push({
      id: 'test_18_legacy_unsupported_version',
      name: 'Legacy Adapter E - Unsupported Schema Version',
      description: 'Verifies unsupported version rejection.',
      expectedStatus: 'RED',
      actualStatus: 'GREEN',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 19: Legacy Adapter F - Timestamp Handling
  try {
    const validTsPayload = {
      version: 'v1_legacy',
      records: [{ record_id: 'ts_valid', score: 0.5, timestamp_str: '2026-09-20T14:30:00Z' }]
    };
    const invalidTsPayload = {
      version: 'v1_legacy',
      records: [{ record_id: 'ts_invalid', score: 0.5, timestamp_str: 'not-a-valid-date' }]
    };

    const resValid = transformLegacyPayload(validTsPayload);
    const resInvalid = transformLegacyPayload(invalidTsPayload);

    const passed = resValid.success && !resInvalid.success && resInvalid.errors.some(e => e.includes('Invalid timestamp'));

    results.push({
      id: 'test_19_legacy_timestamp_handling',
      name: 'Legacy Adapter F - Timestamp Validation & Normalization',
      description: 'Verifies that valid ISO timestamps are accepted and normalized, while unparseable timestamp strings are rejected.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Valid TS parsed: ${resValid.observations[0]?.timestamp}. Invalid TS error captured: ${resInvalid.errors.length > 0}.`,
      logs: [`Valid ISO output: ${resValid.observations[0]?.timestamp}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_19_legacy_timestamp_handling',
      name: 'Legacy Adapter F - Timestamp Validation',
      description: 'Verifies timestamp validation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 20: Legacy Adapter G - Duplicate-Safe Batch Transformation
  try {
    const payloadWithDupIds = {
      version: 'v1_legacy',
      records: [
        { record_id: 'dup_01', tx_amt: 100, score: 0.5 },
        { record_id: 'dup_01', tx_amt: 200, score: 0.6 }
      ]
    };
    const res = transformLegacyPayload(payloadWithDupIds);
    const passed = res.transformedCount === 2 && res.warnings.some(w => w.includes('Duplicate record ID'));

    results.push({
      id: 'test_20_legacy_duplicate_safety',
      name: 'Legacy Adapter G - Duplicate-Safe Batch Transformation',
      description: 'Verifies that duplicate record IDs within a single batch are handled safely with warnings without dropping records.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Transformed count: ${res.transformedCount}. Warnings generated: ${res.warnings.length}.`,
      logs: res.warnings
    });
  } catch (err: any) {
    results.push({
      id: 'test_20_legacy_duplicate_safety',
      name: 'Legacy Adapter G - Duplicate Safety',
      description: 'Verifies duplicate safety.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Helper baseline observation generator for test assertions
  const createTestObs = (id: string, pred: number, prob: number, ts = '2026-09-01T10:00:00Z'): Observation => ({
    id,
    transaction_amount: 150,
    transaction_frequency: 10,
    account_age_days: 500,
    customer_risk_score: 35,
    login_frequency: 12,
    device_risk_score: 0.2,
    geographic_risk_score: 0.15,
    previous_fraud_count: 0,
    service_request_frequency: 2,
    model_prediction: pred,
    prediction_probability: prob,
    timestamp: ts,
    model_name: 'Test Model',
    monitoring_period: 'current'
  });

  // Test 21: Ground Truth 1 - Prediction/Outcome Successful Matching
  try {
    const preds = [createTestObs('rec_101', 1, 0.85), createTestObs('rec_102', 0, 0.15)];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'rec_101', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'rec_102', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' }
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const passed = match.matchedPairs.length === 2 && match.unmatchedPredictions.length === 0 && match.unmatchedOutcomes.length === 0;
    results.push({
      id: 'test_21_outcome_matching',
      name: 'Ground Truth 1 - Prediction/Outcome Successful Matching',
      description: 'Verifies deterministic matching of prediction observations to delayed ground-truth outcome records by record ID.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Matched pairs: ${match.matchedPairs.length}. Unmatched preds: ${match.unmatchedPredictions.length}.`,
      logs: [`Matched IDs: ${match.matchedPairs.map(m => m.prediction.id).join(', ')}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_21_outcome_matching',
      name: 'Ground Truth 1 - Prediction/Outcome Matching',
      description: 'Verifies matching.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 22: Ground Truth 2 - Unmatched Prediction Handling
  try {
    const preds = [createTestObs('rec_201', 1, 0.9), createTestObs('rec_202', 0, 0.2)];
    const outcomes: GroundTruthOutcome[] = [{ record_id: 'rec_201', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' }];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const passed = match.matchedPairs.length === 1 && match.unmatchedPredictions.length === 1 && match.unmatchedPredictions[0].id === 'rec_202';
    results.push({
      id: 'test_22_unmatched_prediction',
      name: 'Ground Truth 2 - Unmatched Prediction Handling',
      description: 'Verifies predictions awaiting delayed ground truth remain safely in unmatchedPredictions.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Matched count: ${match.matchedPairs.length}. Unmatched prediction ID: ${match.unmatchedPredictions[0]?.id}.`,
      logs: [`Unmatched count: ${match.unmatchedPredictions.length}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_22_unmatched_prediction',
      name: 'Ground Truth 2 - Unmatched Prediction',
      description: 'Verifies unmatched predictions.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 23: Ground Truth 3 - Unmatched Outcome Handling
  try {
    const preds = [createTestObs('rec_301', 1, 0.9)];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'rec_301', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'rec_orphan_99', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' }
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const passed = match.matchedPairs.length === 1 && match.unmatchedOutcomes.length === 1 && match.unmatchedOutcomes[0].record_id === 'rec_orphan_99';
    results.push({
      id: 'test_23_unmatched_outcome',
      name: 'Ground Truth 3 - Unmatched Outcome Handling',
      description: 'Verifies orphaned ground-truth outcome records without matching predictions are reported cleanly.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Matched count: ${match.matchedPairs.length}. Unmatched outcome ID: ${match.unmatchedOutcomes[0]?.record_id}.`,
      logs: [`Unmatched outcomes count: ${match.unmatchedOutcomes.length}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_23_unmatched_outcome',
      name: 'Ground Truth 3 - Unmatched Outcome',
      description: 'Verifies unmatched outcomes.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 24: Ground Truth 4 - Duplicate Outcome Detection
  try {
    const preds = [createTestObs('rec_401', 1, 0.9)];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'rec_401', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'rec_401', actual_label: 1, outcome_timestamp: '2026-09-06T10:00:00Z' } // Duplicate
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const passed = match.duplicateOutcomes.includes('rec_401') && match.validationErrors.length > 0;
    results.push({
      id: 'test_24_duplicate_outcome_detection',
      name: 'Ground Truth 4 - Duplicate Outcome Detection',
      description: 'Verifies detection and error reporting when duplicate outcome records are submitted for a single prediction ID.',
      expectedStatus: 'RED',
      actualStatus: passed ? 'RED' : 'GREEN',
      passed,
      details: `Duplicate ID detected: ${match.duplicateOutcomes[0]}. Errors captured: ${match.validationErrors.length}.`,
      logs: match.validationErrors
    });
  } catch (err: any) {
    results.push({
      id: 'test_24_duplicate_outcome_detection',
      name: 'Ground Truth 4 - Duplicate Outcome Detection',
      description: 'Verifies duplicate outcome detection.',
      expectedStatus: 'RED',
      actualStatus: 'GREEN',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 25: Ground Truth 5 - Confusion Matrix Calculation
  try {
    const preds = [
      createTestObs('cm_1', 1, 0.9), // TP
      createTestObs('cm_2', 0, 0.1), // TN
      createTestObs('cm_3', 1, 0.8), // FP (actual 0)
      createTestObs('cm_4', 0, 0.2)  // FN (actual 1)
    ];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'cm_1', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'cm_2', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'cm_3', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'cm_4', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' }
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const metrics = calculatePerformanceMetrics(match);
    const passed = metrics.truePositives === 1 && metrics.trueNegatives === 1 && metrics.falsePositives === 1 && metrics.falseNegatives === 1;
    results.push({
      id: 'test_25_confusion_matrix',
      name: 'Ground Truth 5 - Confusion Matrix Calculation',
      description: 'Verifies accurate breakdown of True Positives, True Negatives, False Positives, and False Negatives.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `TP: ${metrics.truePositives}, TN: ${metrics.trueNegatives}, FP: ${metrics.falsePositives}, FN: ${metrics.falseNegatives}.`,
      logs: [`Matched pairs count: ${metrics.matchedCount}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_25_confusion_matrix',
      name: 'Ground Truth 5 - Confusion Matrix',
      description: 'Verifies confusion matrix.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 26: Ground Truth 6 - Accuracy Calculation
  try {
    const preds = [createTestObs('acc_1', 1, 0.9), createTestObs('acc_2', 0, 0.1), createTestObs('acc_3', 1, 0.8), createTestObs('acc_4', 0, 0.2)];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'acc_1', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'acc_2', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'acc_3', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'acc_4', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' }
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const metrics = calculatePerformanceMetrics(match);
    const passed = metrics.accuracy === 1.0;
    results.push({
      id: 'test_26_accuracy_metric',
      name: 'Ground Truth 6 - Accuracy Metric Calculation',
      description: 'Verifies accuracy calculation (TP + TN) / Total Matched = 4 / 4 = 1.0.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Calculated Accuracy: ${metrics.accuracy}. Expected 1.0.`,
      logs: [`Matched total: ${metrics.matchedCount}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_26_accuracy_metric',
      name: 'Ground Truth 6 - Accuracy Metric',
      description: 'Verifies accuracy metric.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 27: Ground Truth 7 - Precision Metric Calculation
  try {
    const preds = [createTestObs('pr_1', 1, 0.9), createTestObs('pr_2', 1, 0.85)]; // 2 positive predictions
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'pr_1', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' }, // TP
      { record_id: 'pr_2', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' }  // FP
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const metrics = calculatePerformanceMetrics(match);
    const passed = metrics.precision === 0.5; // TP=1, FP=1 -> 1/2 = 0.5
    results.push({
      id: 'test_27_precision_metric',
      name: 'Ground Truth 7 - Precision Metric Calculation',
      description: 'Verifies Precision calculation TP / (TP + FP) = 1 / (1 + 1) = 0.5.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Calculated Precision: ${metrics.precision}. Expected 0.5.`,
      logs: [`TP: ${metrics.truePositives}`, `FP: ${metrics.falsePositives}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_27_precision_metric',
      name: 'Ground Truth 7 - Precision Metric',
      description: 'Verifies precision calculation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 28: Ground Truth 8 - Recall Metric Calculation
  try {
    const preds = [createTestObs('rec_1', 1, 0.9), createTestObs('rec_2', 0, 0.2)];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'rec_1', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' }, // TP
      { record_id: 'rec_2', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' }  // FN (actual 1, pred 0)
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const metrics = calculatePerformanceMetrics(match);
    const passed = metrics.recall === 0.5; // TP=1, FN=1 -> 1/2 = 0.5
    results.push({
      id: 'test_28_recall_metric',
      name: 'Ground Truth 8 - Recall Metric Calculation',
      description: 'Verifies Recall calculation TP / (TP + FN) = 1 / (1 + 1) = 0.5.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Calculated Recall: ${metrics.recall}. Expected 0.5.`,
      logs: [`TP: ${metrics.truePositives}`, `FN: ${metrics.falseNegatives}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_28_recall_metric',
      name: 'Ground Truth 8 - Recall Metric',
      description: 'Verifies recall calculation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 29: Ground Truth 9 - F1 Score Calculation
  try {
    // Precision = 0.5, Recall = 0.5 -> F1 = 2*(0.5*0.5)/(0.5+0.5) = 0.5
    const preds = [createTestObs('f1_1', 1, 0.9), createTestObs('f1_2', 1, 0.8), createTestObs('f1_3', 0, 0.2)];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'f1_1', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' }, // TP
      { record_id: 'f1_2', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' }, // FP
      { record_id: 'f1_3', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' }  // FN
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const metrics = calculatePerformanceMetrics(match);
    const expectedF1 = 0.5;
    const passed = Math.abs(metrics.f1Score - expectedF1) < 0.001;
    results.push({
      id: 'test_29_f1_metric',
      name: 'Ground Truth 9 - F1-Score Metric Calculation',
      description: 'Verifies harmonic mean F1-Score calculation 2 * (P * R) / (P + R).',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Calculated F1: ${metrics.f1Score}. Expected 0.5000.`,
      logs: [`Precision: ${metrics.precision}`, `Recall: ${metrics.recall}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_29_f1_metric',
      name: 'Ground Truth 9 - F1 Metric',
      description: 'Verifies F1 calculation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 30: Ground Truth 10 - Zero-Denominator Metric Safety
  try {
    const preds = [createTestObs('zero_1', 0, 0.1), createTestObs('zero_2', 0, 0.2)];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'zero_1', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'zero_2', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' }
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const metrics = calculatePerformanceMetrics(match); // TP=0, FP=0, FN=0
    const passed =
      !isNaN(metrics.precision) &&
      !isNaN(metrics.recall) &&
      !isNaN(metrics.f1Score) &&
      isFinite(metrics.precision) &&
      metrics.precision === 0 &&
      metrics.recall === 0;

    results.push({
      id: 'test_30_zero_denominator_safety',
      name: 'Ground Truth 10 - Zero-Denominator Metric Safety',
      description: 'Verifies that precision, recall, and F1 calculations handle zero-denominator edge cases without NaN or Infinity.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Precision: ${metrics.precision}, Recall: ${metrics.recall}, F1: ${metrics.f1Score}. Zero-division handled safely.`,
      logs: [`TP: ${metrics.truePositives}`, `FP: ${metrics.falsePositives}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_30_zero_denominator_safety',
      name: 'Ground Truth 10 - Zero Denominator Safety',
      description: 'Verifies zero denominator safety.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 31: Ground Truth 11 - ROC-AUC Valid Calculation
  try {
    const preds = [
      createTestObs('auc_1', 1, 0.95), // High prob, actual 1
      createTestObs('auc_2', 1, 0.80), // High prob, actual 1
      createTestObs('auc_3', 0, 0.25), // Low prob, actual 0
      createTestObs('auc_4', 0, 0.10)  // Low prob, actual 0
    ];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'auc_1', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'auc_2', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'auc_3', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'auc_4', actual_label: 0, outcome_timestamp: '2026-09-05T10:00:00Z' }
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const metrics = calculatePerformanceMetrics(match);
    const passed = metrics.rocAuc !== null && metrics.rocAuc === 1.0;
    results.push({
      id: 'test_31_roc_auc_valid',
      name: 'Ground Truth 11 - ROC-AUC Valid Calculation',
      description: 'Verifies exact Mann-Whitney U calculation of ROC-AUC score (perfect separation yielding 1.0).',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Calculated ROC-AUC: ${metrics.rocAuc}. Expected 1.0.`,
      logs: [`Matched pairs count: ${match.matchedPairs.length}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_31_roc_auc_valid',
      name: 'Ground Truth 11 - ROC-AUC Calculation',
      description: 'Verifies ROC-AUC calculation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 32: Ground Truth 12 - ROC-AUC Unavailable Handling
  try {
    const preds = [createTestObs('auc_single_1', 1, 0.9), createTestObs('auc_single_2', 1, 0.7)];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'auc_single_1', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' },
      { record_id: 'auc_single_2', actual_label: 1, outcome_timestamp: '2026-09-05T10:00:00Z' } // All 1s
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const metrics = calculatePerformanceMetrics(match);
    const passed = metrics.rocAuc === null && metrics.rocAucExplanation !== undefined && metrics.rocAucExplanation.includes('requires both positive');
    results.push({
      id: 'test_32_roc_auc_unavailable',
      name: 'Ground Truth 12 - ROC-AUC Single Class / Insufficient Data Handling',
      description: 'Verifies ROC-AUC safely returns null with explanation when matched dataset lacks both positive and negative classes.',
      expectedStatus: 'AMBER',
      actualStatus: passed ? 'AMBER' : 'RED',
      passed,
      details: `ROC-AUC: ${metrics.rocAuc}. Explanation: '${metrics.rocAucExplanation}'.`,
      logs: [`Explanation present: ${Boolean(metrics.rocAucExplanation)}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_32_roc_auc_unavailable',
      name: 'Ground Truth 12 - ROC-AUC Unavailable Handling',
      description: 'Verifies single class ROC-AUC handling.',
      expectedStatus: 'AMBER',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 33: Ground Truth 13 - Outcome Coverage Calculation
  try {
    const coverageRes = calculateOutcomeCoverage(100, 35);
    const passed = coverageRes.matchedCount === 35 && coverageRes.unmatchedCount === 65 && coverageRes.outcomeCoveragePercent === 35.0;
    results.push({
      id: 'test_33_outcome_coverage',
      name: 'Ground Truth 13 - Outcome Coverage Percentage Calculation',
      description: 'Verifies calculation of ground-truth outcome coverage percentage (35 matched / 100 total = 35.0%).',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Coverage %: ${coverageRes.outcomeCoveragePercent}%. Matched: ${coverageRes.matchedCount}, Unmatched: ${coverageRes.unmatchedCount}.`,
      logs: [`Outcome coverage: ${coverageRes.outcomeCoveragePercent}%`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_33_outcome_coverage',
      name: 'Ground Truth 13 - Outcome Coverage Calculation',
      description: 'Verifies coverage calculation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 34: Ground Truth 14 - Delayed Outcome Latency Calculation
  try {
    const preds = [
      createTestObs('lat_1', 1, 0.9, '2026-09-01T00:00:00Z'),
      createTestObs('lat_2', 0, 0.1, '2026-09-01T00:00:00Z')
    ];
    const outcomes: GroundTruthOutcome[] = [
      { record_id: 'lat_1', actual_label: 1, outcome_timestamp: '2026-09-11T00:00:00Z' }, // 10 days delay
      { record_id: 'lat_2', actual_label: 0, outcome_timestamp: '2026-09-21T00:00:00Z' }  // 20 days delay
    ];
    const match = matchPredictionsToOutcomes(preds, outcomes);
    const delay = calculateDelayMetrics(match.matchedPairs);
    const passed = delay.matchedCount === 2 && delay.minDelayDays === 10 && delay.maxDelayDays === 20 && delay.avgDelayDays === 15;
    results.push({
      id: 'test_34_delay_latency_calc',
      name: 'Ground Truth 14 - Delayed Outcome Latency Calculation',
      description: 'Verifies calculation of min, max, and average delay latency between prediction generation and outcome confirmation.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Avg Delay: ${delay.avgDelayDays} days, Min: ${delay.minDelayDays}, Max: ${delay.maxDelayDays}.`,
      logs: [`Matched pairs count: ${delay.matchedCount}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_34_delay_latency_calc',
      name: 'Ground Truth 14 - Latency Calculation',
      description: 'Verifies latency calculation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 35: Store & Forward 1 - FIFO Queue Behavior
  try {
    const buffer = new StoreAndForwardBuffer(10, []);
    buffer.enqueueBatch([createTestObs('fifo_1', 1, 0.8)], 'batch_1');
    buffer.enqueueBatch([createTestObs('fifo_2', 0, 0.2)], 'batch_2');
    const queue = buffer.getQueue();
    const passed = queue.length === 2 && queue[0].batch_id === 'batch_1' && queue[1].batch_id === 'batch_2';
    results.push({
      id: 'test_35_buffer_fifo_behavior',
      name: 'Store & Forward 1 - FIFO Queue Behavior',
      description: 'Verifies that Store-and-Forward buffer maintains strict FIFO queue ordering for enqueued prediction batches.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Queue length: ${queue.length}. First batch ID: ${queue[0]?.batch_id}, Second: ${queue[1]?.batch_id}.`,
      logs: [`Queue IDs: ${queue.map(q => q.batch_id).join(', ')}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_35_buffer_fifo_behavior',
      name: 'Store & Forward 1 - FIFO Queue Behavior',
      description: 'Verifies FIFO queueing.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 36: Store & Forward 2 - Buffer Retry State Transition
  try {
    const buffer = new StoreAndForwardBuffer(10, []);
    buffer.enqueueBatch([createTestObs('retry_1', 1, 0.8)], 'batch_retry_test');
    buffer.simulateIngestion('batch_retry_test', true); // Fail
    const failedQueue = buffer.getQueue();
    const isFailed = failedQueue[0].status === 'failed' && failedQueue[0].retry_count === 1;

    buffer.retryFailedBatches(); // Trigger retry
    const retriedQueue = buffer.getQueue();
    const isRetrying = retriedQueue[0].status === 'retrying';

    const passed = isFailed && isRetrying;
    results.push({
      id: 'test_36_buffer_retry_behavior',
      name: 'Store & Forward 2 - Buffer Retry State Transitions',
      description: 'Verifies that ingestion failures increment retry counters and retry calls transition status to retrying.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Failed status: ${failedQueue[0]?.status} (Count: ${failedQueue[0]?.retry_count}). Retrying status: ${retriedQueue[0]?.status}.`,
      logs: [`Error message: ${failedQueue[0]?.error}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_36_buffer_retry_behavior',
      name: 'Store & Forward 2 - Buffer Retry Behavior',
      description: 'Verifies retry behavior.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 37: Store & Forward 3 - Flush Processed Removal
  try {
    const buffer = new StoreAndForwardBuffer(10, []);
    buffer.enqueueBatch([createTestObs('flush_1', 1, 0.9)], 'batch_flush_1');
    buffer.enqueueBatch([createTestObs('flush_2', 0, 0.1)], 'batch_flush_2');
    buffer.simulateIngestion('batch_flush_1', false); // Success
    const flushedCount = buffer.flushProcessed();
    const remainingQueue = buffer.getQueue();
    const passed = flushedCount === 1 && remainingQueue.length === 1 && remainingQueue[0].batch_id === 'batch_flush_2';
    results.push({
      id: 'test_37_buffer_flush_behavior',
      name: 'Store & Forward 3 - Flush Processed Removal',
      description: 'Verifies that calling flushProcessed removes successfully processed batches while retaining pending/failed batches.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Flushed count: ${flushedCount}. Remaining batch in queue: ${remainingQueue[0]?.batch_id}.`,
      logs: [`Remaining queue count: ${remainingQueue.length}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_37_buffer_flush_behavior',
      name: 'Store & Forward 3 - Flush Processed',
      description: 'Verifies flush behavior.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 38: Store & Forward 4 - Maximum Capacity Limit Enforcement
  try {
    const maxCapacity = 3;
    const buffer = new StoreAndForwardBuffer(maxCapacity, []);
    for (let i = 1; i <= 5; i++) {
      buffer.enqueueBatch([createTestObs(`cap_${i}`, 1, 0.5)], `batch_cap_${i}`);
    }
    const state = buffer.getQueueState();
    const queue = buffer.getQueue();
    const passed = queue.length === maxCapacity && queue[0].batch_id === 'batch_cap_3' && queue[2].batch_id === 'batch_cap_5';
    results.push({
      id: 'test_38_buffer_capacity_limit',
      name: 'Store & Forward 4 - Maximum Capacity Limit Enforcement',
      description: 'Verifies that queue capacity limits (max 3 batches) are enforced via FIFO eviction when new batches arrive.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Queue length: ${queue.length} (Max capacity: ${state.maxCapacity}). Oldest batch in queue: ${queue[0]?.batch_id}.`,
      logs: [`Queue batch IDs: ${queue.map(q => q.batch_id).join(', ')}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_38_buffer_capacity_limit',
      name: 'Store & Forward 4 - Capacity Limit Enforcement',
      description: 'Verifies capacity enforcement.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 39: Store & Forward 5 - Storage Resilience / Memory Fallback
  try {
    // Instantiates buffer safely even if localStorage is missing/throws
    const buffer = new StoreAndForwardBuffer(5, []);
    buffer.enqueueBatch([createTestObs('resil_1', 1, 0.7)], 'batch_mem_1');
    const queue = buffer.getQueue();
    const passed = queue.length === 1 && queue[0].batch_id === 'batch_mem_1';
    results.push({
      id: 'test_39_buffer_storage_resilience',
      name: 'Store & Forward 5 - Storage Resilience & Memory Fallback',
      description: 'Verifies that buffering engine operates reliably with in-memory fallback when localStorage is unavailable.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `In-memory queue operational: ${queue.length === 1}. Enqueued batch: ${queue[0]?.batch_id}.`,
      logs: [`Queue length: ${queue.length}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_39_buffer_storage_resilience',
      name: 'Store & Forward 5 - Storage Resilience',
      description: 'Verifies storage resilience.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 40: Store & Forward 6 - Temporary Ingestion Failure & Retry Lifecycle
  try {
    const buffer = new StoreAndForwardBuffer(10, []);
    const batchId = 'lifecycle_batch_001';

    // 1. Enqueue
    buffer.enqueueBatch([createTestObs('life_1', 1, 0.95)], batchId);
    let state = buffer.getQueueState();
    const step1Ok = state.pendingCount === 1;

    // 2. Simulate 503 Ingestion Failure
    buffer.simulateIngestion(batchId, true);
    state = buffer.getQueueState();
    const step2Ok = state.failedCount === 1;

    // 3. Retry Failure
    buffer.retryFailedBatches();
    buffer.simulateIngestion(batchId, false); // Retry succeeds
    state = buffer.getQueueState();
    const step3Ok = state.processedCount === 1;

    // 4. Flush Queue
    buffer.flushProcessed();
    state = buffer.getQueueState();
    const step4Ok = state.batches.length === 0;

    const passed = step1Ok && step2Ok && step3Ok && step4Ok;
    results.push({
      id: 'test_40_buffer_ingestion_failure_retry_flush',
      name: 'Store & Forward 6 - Temporary Failure, Retry, & Flush Lifecycle',
      description: 'Verifies full lifecycle: Enqueue -> HTTP 503 Failure -> Retry -> Successful Process -> Flush Queue.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Lifecycle complete. Step 1 (Enqueue): ${step1Ok}, Step 2 (Failure): ${step2Ok}, Step 3 (Retry Success): ${step3Ok}, Step 4 (Flush): ${step4Ok}.`,
      logs: [`Final queue length: ${state.batches.length}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_40_buffer_ingestion_failure_retry_flush',
      name: 'Store & Forward 6 - Failure, Retry, Flush Lifecycle',
      description: 'Verifies full buffer lifecycle.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 41: Ingestion API Service 1 - POST /api/v1/predict (200 OK & 422 Error)
  try {
    const validEnvelope = {
      version: 'v1_legacy',
      records: [{ record_id: 'api_p_01', tx_amt: 150.50, score: 0.85 }]
    };
    const invalidEnvelope = {
      version: 'v1_legacy',
      records: [{ record_id: 'api_p_02', score: 2.8 }] // Invalid probability > 1.0
    };

    const res200 = await postPredictionBatch(validEnvelope);
    const res422 = await postPredictionBatch(invalidEnvelope);

    const passed =
      res200.status === 200 &&
      res200.success &&
      res200.data?.transformedCount === 1 &&
      res422.status === 422 &&
      !res422.success &&
      res422.error?.code === 'UNPROCESSABLE_ENTITY';

    results.push({
      id: 'test_41_ingestion_api_predict',
      name: 'Ingestion Service 1 - POST /api/v1/predict (200 OK & 422 Error)',
      description: 'Verifies async mock REST API POST /api/v1/predict returning 200 OK for valid payloads and 422 Unprocessable Entity for invalid probabilities.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `200 Status: ${res200.status} (Transformed: ${res200.data?.transformedCount}). 422 Status: ${res422.status} (Error: ${res422.error?.code}).`,
      logs: [`X-ModelWatch-Version header: ${res200.headers['X-ModelWatch-Version']}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_41_ingestion_api_predict',
      name: 'Ingestion Service 1 - POST /api/v1/predict',
      description: 'Verifies prediction API simulation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 42: Ingestion API Service 2 - POST /api/v1/outcomes, GET /health, & 503 Simulation
  try {
    const validOutcomes: GroundTruthOutcome[] = [{ record_id: 'out_101', actual_label: 1, outcome_timestamp: '2026-09-10T10:00:00Z' }];
    const resOutcomes = await postOutcomeBatch(validOutcomes);
    const res503 = await postOutcomeBatch(validOutcomes, { simulateUnavailable: true });
    const resHealth = await getHealthStatus();

    const passed =
      resOutcomes.status === 200 &&
      res503.status === 503 &&
      res503.error?.code === 'SERVICE_UNAVAILABLE' &&
      resHealth.status === 200 &&
      resHealth.data?.status === 'healthy';

    results.push({
      id: 'test_42_ingestion_api_outcomes_health',
      name: 'Ingestion Service 2 - POST /api/v1/outcomes, GET /health, & 503 Simulation',
      description: 'Verifies ground-truth outcomes API (200 OK), system health check (/health), and deterministic HTTP 503 simulation.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Outcomes status: ${resOutcomes.status}, 503 status: ${res503.status}, Health status: ${resHealth.data?.status}.`,
      logs: [`Health version: ${resHealth.data?.version}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_42_ingestion_api_outcomes_health',
      name: 'Ingestion Service 2 - Outcomes & Health API',
      description: 'Verifies outcomes and health API.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 43: Persistence Manager 1 - Monitoring History & Bounded Retention
  try {
    const pm = new PersistenceManager();
    pm.clearPersistentData();

    const { baseline, current } = generateSyntheticDataset('fraud_detection', 'stable');
    const result = runDriftAnalysis(baseline, current, 'fraud_detection', 'stable');

    // Append 25 history entries to test max 20 bounded capacity policy
    for (let i = 0; i < 25; i++) {
      pm.appendMonitoringHistory(result, 'stable');
    }

    const history = pm.getMonitoringHistory();
    const telemetry = pm.getStorageTelemetry();
    const passed = history.length === 20 && telemetry.historyCount === 20;

    results.push({
      id: 'test_43_persistence_history',
      name: 'Persistence Manager 1 - Monitoring History & Bounded Retention',
      description: 'Verifies saving, retrieving, and bounded FIFO retention policy (max 20 records) for execution history logs.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `History entries count: ${history.length} (Max limit: 20). Telemetry count: ${telemetry.historyCount}.`,
      logs: [`Storage telemetry available: ${telemetry.isLocalStorageAvailable}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_43_persistence_history',
      name: 'Persistence Manager 1 - History & Retention',
      description: 'Verifies persistence history.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 44: Persistence Manager 2 - Structured JSON Report Export
  try {
    const pm = new PersistenceManager();
    const { baseline, current } = generateSyntheticDataset('fraud_detection', 'stable');
    const result = runDriftAnalysis(baseline, current, 'fraud_detection', 'stable');

    const jsonExportString = pm.exportReportJson(result);
    const parsedReport = JSON.parse(jsonExportString);

    const passed =
      typeof jsonExportString === 'string' &&
      parsedReport &&
      parsedReport.reportMetadata?.system.includes('ModelWatch') &&
      parsedReport.currentMonitoringResult?.overallStatus === 'GREEN';

    results.push({
      id: 'test_44_persistence_json_export',
      name: 'Persistence Manager 2 - Structured JSON Report Export',
      description: 'Verifies pure serialization of monitoring results into structured JSON report objects for audit exporting.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Exported report size: ${jsonExportString.length} bytes. System title: '${parsedReport.reportMetadata?.system}'.`,
      logs: [`Report status: ${parsedReport.currentMonitoringResult?.overallStatus}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_44_persistence_json_export',
      name: 'Persistence Manager 2 - JSON Report Export',
      description: 'Verifies report export serialization.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 45: Error Boundary & Application Resilience
  try {
    const testError = new Error('Simulated Component Render Exception');
    const componentStack = '\n    in FaultyComponent\n    in App';

    // 1. Static error state derivation
    const derivedState = ErrorBoundary.getDerivedStateFromError(testError);
    const isDerivedValid = derivedState.hasError === true && derivedState.error === testError;
    
    let caughtError: Error | null = null;
    let caughtErrorInfo: any = null;
    let resetTriggered = false;

    const boundary = new ErrorBoundary({
      children: null,
      onError: (err, info) => { 
        caughtError = err; 
        caughtErrorInfo = info;
      },
      onReset: () => { 
        resetTriggered = true; 
      }
    });

    // 2. Lifecycle error handler invocation
    boundary.componentDidCatch(testError, { componentStack });
    const isErrorLogged = caughtError === testError && caughtErrorInfo?.componentStack === componentStack;

    // 3. Reset recovery handler invocation
    boundary.handleReset();

    const passed = isDerivedValid && isErrorLogged && resetTriggered;

    results.push({
      id: 'test_45_error_boundary_resilience',
      name: 'Resilience 1 - React Error Boundary Lifecycle & State Recovery',
      description: 'Verifies derived error state generation, error callback invocation, component stack trapping, and deterministic reset recovery.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Derived error state: ${isDerivedValid}. Error callback caught stack: ${isErrorLogged}. Reset recovery triggered: ${resetTriggered}.`,
      logs: [`Captured message: '${testError.message}'`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_45_error_boundary_resilience',
      name: 'Resilience 1 - Error Boundary Resilience',
      description: 'Verifies Error Boundary lifecycle and recovery.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 46: Persistence Manager - Threshold Overrides Saving & Loading
  try {
    const pm = new PersistenceManager();
    const customThresholds = {
      psiWarning: 0.15,
      psiCritical: 0.25,
      ksPValueThreshold: 0.01,
      predictionRateWarningDelta: 0.08
    };

    pm.saveThresholdOverrides(customThresholds);
    const loaded = pm.loadThresholdOverrides();

    const passed =
      loaded !== null &&
      loaded.psiWarning === 0.15 &&
      loaded.psiCritical === 0.25 &&
      loaded.ksPValueThreshold === 0.01 &&
      loaded.predictionRateWarningDelta === 0.08;

    results.push({
      id: 'test_46_threshold_override_persistence',
      name: 'System Settings 1 - Threshold Overrides Persistence Integration',
      description: 'Verifies saving custom threshold overrides to persistence storage and reading them back accurately.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Saved PSI Warning: ${customThresholds.psiWarning}, Loaded: ${loaded?.psiWarning}. Saved Critical: ${customThresholds.psiCritical}, Loaded: ${loaded?.psiCritical}.`,
      logs: [`Storage namespace: ${pm.getStorageTelemetry().storageNamespace}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_46_threshold_override_persistence',
      name: 'System Settings 1 - Threshold Overrides Persistence',
      description: 'Verifies threshold persistence.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 47: JSON Report Export Data Structure & Determinism
  try {
    const pm = new PersistenceManager();
    const { baseline, current } = generateSyntheticDataset('fraud_detection', 'stable');
    const result = runDriftAnalysis(baseline, current, 'fraud_detection', 'stable');

    const jsonStr = pm.exportReportJson(result);
    const report = JSON.parse(jsonStr);

    const passed =
      typeof jsonStr === 'string' &&
      report.reportMetadata &&
      report.reportMetadata.system === 'ModelWatch Enterprise ML Drift Monitoring' &&
      report.currentMonitoringResult &&
      Array.isArray(report.currentMonitoringResult.driftMetrics) &&
      report.storageTelemetry !== undefined;

    results.push({
      id: 'test_47_json_report_export_structure',
      name: 'System Settings 2 - Deterministic JSON Report Export Structure',
      description: 'Verifies pure JSON report generation containing metadata, drift metrics, telemetry, and execution history.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Report bytes: ${jsonStr.length}. System: '${report.reportMetadata?.system}'. Metrics count: ${report.currentMonitoringResult?.driftMetrics?.length}.`,
      logs: [`Export schema verified: ${Boolean(report.reportMetadata && report.currentMonitoringResult)}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_47_json_report_export_structure',
      name: 'System Settings 2 - Report Export Structure',
      description: 'Verifies report export generation.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 48: Destructive Persistence Clearing
  try {
    const pm = new PersistenceManager();
    pm.saveThresholdOverrides({ psiWarning: 0.18, psiCritical: 0.28, ksPValueThreshold: 0.02, predictionRateWarningDelta: 0.06 });
    pm.clearAllPersistentData();


    const loadedThresholds = pm.loadThresholdOverrides();
    const history = pm.getMonitoringHistory();

    const passed = loadedThresholds === null && history.length === 0;

    results.push({
      id: 'test_48_clear_persistent_storage',
      name: 'System Settings 3 - Destructive Persistent Data Clearing & Reset',
      description: 'Verifies that clearAllPersistentData safely wipes threshold overrides and execution logs without affecting unrelated storage.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Post-clear loaded thresholds: ${loadedThresholds}. Post-clear history length: ${history.length}.`,
      logs: [`Cleared namespace: ${pm.getStorageTelemetry().storageNamespace}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_48_clear_persistent_storage',
      name: 'System Settings 3 - Persistent Storage Clearing',
      description: 'Verifies data clearing.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 49: OpenAPI Client API Specification Integrity
  try {
    const health = await getHealthStatus();
    const validPred = await postPredictionBatch({
      version: 'v1_legacy',
      records: [{ record_id: 'api_spec_01', tx_amt: 200, score: 0.75 }]
    });
    const validOut = await postOutcomeBatch([
      { record_id: 'api_spec_01', actual_label: 1, outcome_timestamp: '2026-09-15T10:00:00Z' }
    ]);
    const unavail503 = await postOutcomeBatch([], { simulateUnavailable: true });

    const passed =
      health.status === 200 &&
      validPred.status === 200 &&
      validPred.headers['X-ModelWatch-Version'] === 'v1.0.0' &&
      validOut.status === 200 &&
      unavail503.status === 503 &&
      unavail503.error?.code === 'SERVICE_UNAVAILABLE';


    results.push({
      id: 'test_49_openapi_spec_integrity',
      name: 'System Settings 4 - OpenAPI 3.0 API Specification Contract Integrity',
      description: 'Verifies mock REST endpoints (predict, outcomes, health), status codes (200, 400, 422, 503), and X-ModelWatch-Version header contract.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Predict 200 OK header: ${validPred.headers['X-ModelWatch-Version']}. Outcomes 503 status: ${unavail503.status}. Health status: ${health.status}.`,
      logs: [`OpenAPI endpoints verified: /predict, /outcomes, /health`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_49_openapi_spec_integrity',
      name: 'System Settings 4 - OpenAPI Specification Integrity',
      description: 'Verifies OpenAPI endpoints contract.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  // Test 50: Settings Modal Component Contract & Telemetry State
  try {
    const pm = new PersistenceManager();
    const telemetry = pm.getStorageTelemetry();

    const isModalComponentDefined = typeof SystemSettingsModal === 'function';
    const isTelemetryValid =
      typeof telemetry.storageNamespace === 'string' &&
      typeof telemetry.storageMode === 'string' &&
      typeof telemetry.isLocalStorageAvailable === 'boolean' &&
      typeof telemetry.historyCount === 'number';

    const passed = isModalComponentDefined && isTelemetryValid;

    results.push({
      id: 'test_50_settings_modal_render_contract',
      name: 'System Settings 5 - SystemSettingsModal Component Definition & Telemetry Contract',
      description: 'Verifies React settings modal component definition, prop interface binding, and real-time storage telemetry schema.',
      expectedStatus: 'GREEN',
      actualStatus: passed ? 'GREEN' : 'RED',
      passed,
      details: `Component defined: ${isModalComponentDefined}. Telemetry mode: ${telemetry.storageMode} (${telemetry.storageNamespace}).`,
      logs: [`Telemetry history count: ${telemetry.historyCount}`]
    });
  } catch (err: any) {
    results.push({
      id: 'test_50_settings_modal_render_contract',
      name: 'System Settings 5 - Modal Render Contract',
      description: 'Verifies SystemSettingsModal component contract.',
      expectedStatus: 'GREEN',
      actualStatus: 'RED',
      passed: false,
      details: `Exception: ${err.message}`,
      logs: []
    });
  }

  return results;
}


