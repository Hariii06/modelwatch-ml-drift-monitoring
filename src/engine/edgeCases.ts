import { Observation, ScenarioType } from '../types/monitoring';

/**
 * Apply edge-case perturbations (missing values or extreme outliers) to a dataset copy
 */
export function applyEdgeCaseScenario(
  observations: Observation[],
  scenario: ScenarioType
): { processedObservations: Observation[]; missingnessWarning?: string; outlierWarning?: string } {
  // Deep clone to keep baseline/original dataset intact
  const processed: Observation[] = observations.map(obs => ({ ...obs }));

  if (scenario === 'missing_data') {
    let missingCount = 0;
    const targetCount = Math.floor(processed.length * 0.18); // 18% missingness injection

    for (let i = 0; i < targetCount; i++) {
      const idx = Math.floor((i / targetCount) * processed.length);
      processed[idx].transaction_amount = null;
      missingCount++;
    }

    const missingPercent = ((missingCount / processed.length) * 100).toFixed(1);
    return {
      processedObservations: processed,
      missingnessWarning: `Warning: High missingness detected in feature 'transaction_amount' (${missingCount} records, ${missingPercent}% missing). Drift calculation proceeded using valid observations.`
    };
  }

  if (scenario === 'noisy_data') {
    let outlierCount = 0;
    const targetCount = Math.floor(processed.length * 0.04); // 4% extreme outliers

    for (let i = 0; i < targetCount; i++) {
      const idx = (i * 25) % processed.length;
      // Inject extreme transaction amount (e.g. $45,000 to $120,000 vs normal $185)
      processed[idx].transaction_amount = 45000 + (i * 3500) % 75000;
      outlierCount++;
    }

    return {
      processedObservations: processed,
      outlierWarning: `Warning: Severe extreme values / noisy outliers detected in 'transaction_amount' (${outlierCount} extreme records, max value $120,000.00). Statistical calculations remained operational.`
    };
  }

  return { processedObservations: processed };
}
