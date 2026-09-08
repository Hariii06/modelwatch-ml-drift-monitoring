import { calculatePSI, calculateKS } from '../engine/statistics';
import { generateSyntheticDataset } from '../engine/generator';
import { runDriftAnalysis, DEFAULT_THRESHOLDS } from '../engine/driftEngine';
import { TestCaseResult } from '../types/monitoring';

export function executeUnitTests(): TestCaseResult[] {
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

  return results;
}
