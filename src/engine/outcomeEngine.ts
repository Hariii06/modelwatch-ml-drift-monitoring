import {
  Observation,
  GroundTruthOutcome,
  MatchedPair,
  OutcomeMatchResult,
  PerformanceMetrics,
  DelayMetrics
} from '../types/monitoring';

/**
 * Pure, deterministic engine matching prediction observations to delayed real-world ground-truth outcomes.
 */
export function matchPredictionsToOutcomes(
  predictions: Observation[],
  outcomes: GroundTruthOutcome[]
): OutcomeMatchResult {
  const validationErrors: string[] = [];
  const duplicateOutcomes: string[] = [];
  const matchedPairs: MatchedPair[] = [];
  const unmatchedOutcomes: GroundTruthOutcome[] = [];

  // Map predictions by ID for O(1) lookup
  const predictionMap = new Map<string, Observation>();
  const matchedPredictionIds = new Set<string>();

  predictions.forEach(p => {
    if (p && p.id) {
      predictionMap.set(p.id, p);
    }
  });

  const seenOutcomeIds = new Set<string>();

  outcomes.forEach((outcome, idx) => {
    const outcomeNum = idx + 1;
    if (!outcome || !outcome.record_id) {
      validationErrors.push(`Outcome #${outcomeNum}: Missing record_id.`);
      return;
    }

    if (seenOutcomeIds.has(outcome.record_id)) {
      duplicateOutcomes.push(outcome.record_id);
      validationErrors.push(`Outcome #${outcomeNum}: Duplicate outcome record_id '${outcome.record_id}'.`);
      return;
    }
    seenOutcomeIds.add(outcome.record_id);

    if (outcome.actual_label !== 0 && outcome.actual_label !== 1) {
      validationErrors.push(`Outcome #${outcomeNum} ('${outcome.record_id}'): Invalid actual_label '${outcome.actual_label}'. Must be 0 or 1.`);
      return;
    }

    const matchedPred = predictionMap.get(outcome.record_id);
    if (matchedPred) {
      matchedPredictionIds.add(matchedPred.id);

      // Compute delay in days
      let delayDays = outcome.delay_days ?? 0;
      if (outcome.delay_days === undefined) {
        const predTime = Date.parse(matchedPred.timestamp);
        const outTime = Date.parse(outcome.outcome_timestamp);
        if (!isNaN(predTime) && !isNaN(outTime)) {
          delayDays = Math.max(0, Math.round(((outTime - predTime) / (1000 * 60 * 60 * 24)) * 10) / 10);
        }
      }

      matchedPairs.push({
        prediction: matchedPred,
        outcome,
        delayDays
      });
    } else {
      unmatchedOutcomes.push(outcome);
    }
  });

  const unmatchedPredictions = predictions.filter(p => !matchedPredictionIds.has(p.id));

  return {
    matchedPairs,
    unmatchedPredictions,
    unmatchedOutcomes,
    duplicateOutcomes,
    validationErrors
  };
}

/**
 * Calculates confusion matrix and model performance metrics (Accuracy, Precision, Recall, F1, ROC-AUC)
 * with zero-denominator safety checks.
 */
export function calculatePerformanceMetrics(
  matchResult: OutcomeMatchResult,
  totalPredictionsCount?: number
): PerformanceMetrics {
  const { matchedPairs, unmatchedPredictions } = matchResult;
  const matchedCount = matchedPairs.length;
  const totalPredictions = totalPredictionsCount ?? (matchedCount + unmatchedPredictions.length);
  const unmatchedCount = Math.max(0, totalPredictions - matchedCount);

  const outcomeCoveragePercent = totalPredictions > 0
    ? Math.round((matchedCount / totalPredictions) * 1000) / 10
    : 0;

  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  matchedPairs.forEach(({ prediction, outcome }) => {
    const pred = prediction.model_prediction;
    const actual = outcome.actual_label;

    if (pred === 1 && actual === 1) tp++;
    else if (pred === 0 && actual === 0) tn++;
    else if (pred === 1 && actual === 0) fp++;
    else if (pred === 0 && actual === 1) fn++;
  });

  // Zero-denominator safe calculations
  const accuracy = matchedCount > 0 ? (tp + tn) / matchedCount : 0;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const { rocAuc, rocAucExplanation } = calculateRocAuc(matchedPairs);

  return {
    truePositives: tp,
    trueNegatives: tn,
    falsePositives: fp,
    falseNegatives: fn,
    accuracy: Math.round(accuracy * 10000) / 10000,
    precision: Math.round(precision * 10000) / 10000,
    recall: Math.round(recall * 10000) / 10000,
    f1Score: Math.round(f1Score * 10000) / 10000,
    rocAuc,
    rocAucExplanation,
    matchedCount,
    unmatchedCount,
    totalPredictions,
    outcomeCoveragePercent
  };
}

/**
 * Calculates exact ROC-AUC score from prediction probabilities and actual labels
 * using Mann-Whitney U rank-sum method with rank tie averaging.
 */
export function calculateRocAuc(matchedPairs: MatchedPair[]): { rocAuc: number | null; rocAucExplanation?: string } {
  if (!matchedPairs || matchedPairs.length < 2) {
    return {
      rocAuc: null,
      rocAucExplanation: 'ROC-AUC unavailable: requires at least 2 matched prediction-outcome pairs.'
    };
  }

  const items = matchedPairs.map(mp => ({
    prob: mp.prediction.prediction_probability,
    label: mp.outcome.actual_label
  }));

  const n1 = items.filter(i => i.label === 1).length; // Positives
  const n0 = items.filter(i => i.label === 0).length; // Negatives

  if (n1 === 0 || n0 === 0) {
    return {
      rocAuc: null,
      rocAucExplanation: 'ROC-AUC unavailable: requires both positive (1) and negative (0) actual outcome classes in matched sample.'
    };
  }

  // Sort by probability ascending
  items.sort((a, b) => a.prob - b.prob);

  // Assign fractional ranks handling ties
  const ranks = new Array<number>(items.length);
  let i = 0;
  while (i < items.length) {
    let j = i;
    while (j < items.length && items[j].prob === items[i].prob) {
      j++;
    }
    const averageRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[k] = averageRank;
    }
    i = j;
  }

  // Sum ranks for positive class
  let posRankSum = 0;
  for (let k = 0; k < items.length; k++) {
    if (items[k].label === 1) {
      posRankSum += ranks[k];
    }
  }

  // Mann-Whitney U statistic
  const u = posRankSum - (n1 * (n1 + 1)) / 2;
  const auc = u / (n1 * n0);

  const boundedAuc = Math.min(1.0, Math.max(0.0, Math.round(auc * 10000) / 10000));
  return { rocAuc: boundedAuc };
}

/**
 * Calculates outcome coverage ratio and counts
 */
export function calculateOutcomeCoverage(
  predictionsCount: number,
  matchedCount: number
): { matchedCount: number; unmatchedCount: number; outcomeCoveragePercent: number } {
  const unmatchedCount = Math.max(0, predictionsCount - matchedCount);
  const outcomeCoveragePercent = predictionsCount > 0
    ? Math.round((matchedCount / predictionsCount) * 1000) / 10
    : 0;

  return {
    matchedCount,
    unmatchedCount,
    outcomeCoveragePercent
  };
}

/**
 * Calculates aggregate delay / latency metrics across matched prediction-outcome pairs
 */
export function calculateDelayMetrics(matchedPairs: MatchedPair[]): DelayMetrics {
  if (!matchedPairs || matchedPairs.length === 0) {
    return {
      matchedCount: 0,
      avgDelayDays: 0,
      minDelayDays: 0,
      maxDelayDays: 0
    };
  }

  const delays = matchedPairs.map(p => p.delayDays);
  const sum = delays.reduce((acc, d) => acc + d, 0);
  const avg = sum / delays.length;
  const min = Math.min(...delays);
  const max = Math.max(...delays);

  return {
    matchedCount: matchedPairs.length,
    avgDelayDays: Math.round(avg * 10) / 10,
    minDelayDays: Math.round(min * 10) / 10,
    maxDelayDays: Math.round(max * 10) / 10
  };
}
