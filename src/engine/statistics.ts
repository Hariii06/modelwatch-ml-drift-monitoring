import { FeatureStats, BinDistribution } from '../types/monitoring';

/**
 * Filter out null/NaN values from numerical array
 */
export function getValidValues(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => typeof v === 'number' && !isNaN(v) && isFinite(v));
}

/**
 * Calculate basic descriptive statistics for a numerical sample
 */
export function calculateFeatureStats(values: (number | null | undefined)[]): FeatureStats {
  const totalCount = values.length;
  const valid = getValidValues(values);
  const missingCount = totalCount - valid.length;
  const missingPercentage = totalCount > 0 ? (missingCount / totalCount) * 100 : 0;

  if (valid.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      missingCount,
      missingPercentage
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;

  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    missingCount,
    missingPercentage
  };
}

/**
 * Population Stability Index (PSI) Calculation Engine
 *
 * MATHEMATICAL FORMULA:
 *   PSI = \sum_{i=1}^{k} \left( E_i - A_i \right) \times \ln\left( \frac{E_i}{A_i} \right)
 *
 *   Where:
 *   - A_i (Expected / Baseline): Proportion of baseline observations in bin i (A_i = count_baseline_i / N_baseline)
 *   - E_i (Actual / Current): Proportion of current monitoring observations in bin i (E_i = count_current_i / N_current)
 *   - k: Total number of active monitoring bins (default k = 10)
 *
 * BINNING STRATEGY & FALLBACKS:
 * 1. Quantile Binning: Attempts to derive 10 quantile bin boundaries from baseline valid values,
 *    distributing baseline observations evenly across 10 quantile bins.
 * 2. Monotonic Boundary Check: Enforces strict monotonic growth (`edge > previous_edge`) to skip duplicate
 *    quantiles caused by repeating data values.
 * 3. Equal-Width Fallback: If unique quantile boundaries are fewer than 3 (`binEdges.length < 4`), the engine
 *    automatically falls back to equal-width binning spanning `[minVal, maxVal]`.
 * 4. Zero-Variance & Constant Arrays: For constant arrays (where minVal === maxVal), `(maxVal - minVal) / numBins`
 *    evaluates to 0, which falls back to `step = 1`. All values safely fall into the first bin.
 * 5. Small Array Resilience (e.g. N = 3): Fallback equal-width binning guarantees finite, non-crashing output
 *    without throwing array index exceptions.
 * 6. Scale Invariance: Linear scaling of baseline and current data (e.g. multiplying by 1,000) scales bin
 *    boundaries proportionally while preserving relative bin ratios, maintaining scale invariance.
 *
 * NUMERICAL SMOOTHING & ZERO-FREQUENCY PREVENTION:
 * - Small Smoothing Constant (\epsilon = 1e-4): Applied via `Math.max(rawRatio, 1e-4)`. This prevents
 *   division-by-zero or undefined logarithm calculations (`\ln(0)` = -\infty) when a bin contains zero
 *   observations in baseline or current monitoring windows.
 *
 * INVALID & EMPTY INPUT HANDLING:
 * - Null/NaN Filtering: All inputs pass through `getValidValues()`.
 * - Empty Array Safety: Returns `{ psiScore: 0, bins: [] }` if either baseline or current valid count is 0.
 *
 * @param baselineRaw Array of raw baseline observations (numerical, null, or undefined)
 * @param currentRaw Array of raw current period observations (numerical, null, or undefined)
 * @param numBins Number of distribution bins to compute (default 10)
 * @returns Object containing aggregate PSI score and array of detailed BinDistribution objects
 */
export function calculatePSI(
  baselineRaw: (number | null | undefined)[],
  currentRaw: (number | null | undefined)[],
  numBins = 10
): { psiScore: number; bins: BinDistribution[] } {
  const baseline = getValidValues(baselineRaw);
  const current = getValidValues(currentRaw);

  if (baseline.length === 0 || current.length === 0) {
    return { psiScore: 0, bins: [] };
  }

  const sortedBaseline = [...baseline].sort((a, b) => a - b);
  const minVal = sortedBaseline[0];
  const maxVal = sortedBaseline[sortedBaseline.length - 1];

  // Derive bin edges using quantiles if possible, else equal width
  const binEdges: number[] = [minVal - 0.0001];
  for (let i = 1; i < numBins; i++) {
    const idx = Math.floor((i / numBins) * (sortedBaseline.length - 1));
    const edge = sortedBaseline[idx];
    // Ensure monotonically non-decreasing
    if (edge > binEdges[binEdges.length - 1]) {
      binEdges.push(edge);
    }
  }
  binEdges.push(maxVal + 0.0001);

  // If unique quantile edges are fewer than 3, fallback to equal width
  let finalEdges = binEdges;
  if (binEdges.length < 4) {
    finalEdges = [];
    const step = (maxVal - minVal) / numBins || 1;
    for (let i = 0; i <= numBins; i++) {
      finalEdges.push(minVal - 0.0001 + i * step);
    }
  }

  const actualNumBins = finalEdges.length - 1;
  const baselineCounts = new Array(actualNumBins).fill(0);
  const currentCounts = new Array(actualNumBins).fill(0);

  // Count baseline
  for (const val of baseline) {
    for (let b = 0; b < actualNumBins; b++) {
      if (val >= finalEdges[b] && val < finalEdges[b + 1]) {
        baselineCounts[b]++;
        break;
      }
    }
  }

  // Count current
  for (const val of current) {
    for (let b = 0; b < actualNumBins; b++) {
      if (val >= finalEdges[b] && val < finalEdges[b + 1]) {
        currentCounts[b]++;
        break;
      }
    }
  }

  const baselineTotal = baseline.length;
  const currentTotal = current.length;
  const epsilon = 1e-4; // Smoothing factor

  let totalPSI = 0;
  const bins: BinDistribution[] = [];

  for (let b = 0; b < actualNumBins; b++) {
    const bCount = baselineCounts[b];
    const cCount = currentCounts[b];

    const rawBProp = bCount / baselineTotal;
    const rawCProp = cCount / currentTotal;

    // Apply smoothing for log calculation
    const bProp = Math.max(rawBProp, epsilon);
    const cProp = Math.max(rawCProp, epsilon);

    const psiContrib = (cProp - bProp) * Math.log(cProp / bProp);
    totalPSI += psiContrib;

    const bMin = finalEdges[b];
    const bMax = finalEdges[b + 1];

    bins.push({
      binMin: bMin,
      binMax: bMax,
      label: `${bMin.toFixed(1)} - ${bMax.toFixed(1)}`,
      baselineRatio: rawBProp,
      currentRatio: rawCProp,
      baselineCount: bCount,
      currentCount: cCount,
      psiContribution: psiContrib
    });
  }

  return {
    psiScore: Math.max(0, totalPSI),
    bins
  };
}

/**
 * Kolmogorov-Smirnov (KS) two-sample test statistic D and asymptotic p-value
 */
export function calculateKS(
  baselineRaw: (number | null | undefined)[],
  currentRaw: (number | null | undefined)[]
): { ksStatistic: number; pValue: number } {
  const sample1 = getValidValues(baselineRaw).sort((a, b) => a - b);
  const sample2 = getValidValues(currentRaw).sort((a, b) => a - b);

  const n1 = sample1.length;
  const n2 = sample2.length;

  if (n1 === 0 || n2 === 0) {
    return { ksStatistic: 0, pValue: 1.0 };
  }

  // Evaluate ECDF difference at all unique evaluation points in sorted combined sample
  const allVals = Array.from(new Set([...sample1, ...sample2])).sort((a, b) => a - b);
  let i = 0;
  let j = 0;
  let maxD = 0;

  for (const x of allVals) {
    while (i < n1 && sample1[i] <= x) {
      i++;
    }
    while (j < n2 && sample2[j] <= x) {
      j++;
    }

    const cdf1 = i / n1;
    const cdf2 = j / n2;
    const diff = Math.abs(cdf1 - cdf2);
    if (diff > maxD) {
      maxD = diff;
    }
  }

  // Calculate asymptotic p-value
  const en = Math.sqrt((n1 * n2) / (n1 + n2));
  const lambda = (en + 0.12 + 0.11 / en) * maxD;

  let pValue = 0;
  if (lambda <= 0) {
    pValue = 1.0;
  } else {
    let sum = 0;
    for (let k = 1; k <= 100; k++) {
      const term = Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
      sum += term;
      if (Math.abs(term) < 1e-10) break;
    }
    pValue = Math.min(1.0, Math.max(0.0, 2 * sum));
  }

  return {
    ksStatistic: maxD,
    pValue
  };
}
