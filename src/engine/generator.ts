import { Observation, ModelType, ScenarioType } from '../types/monitoring';

class SeededRandom {
  private seed: number;

  constructor(seed: number = 42) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  normal(mean: number = 0, stdDev: number = 1): number {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdDev;
  }

  logNormal(meanLog: number, stdLog: number): number {
    const norm = this.normal(meanLog, stdLog);
    return Math.exp(norm);
  }

  uniform(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  poisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > L);
    return k - 1;
  }
}

export function generateSyntheticDataset(
  modelType: ModelType = 'fraud_detection',
  scenario: ScenarioType = 'stable'
): { baseline: Observation[]; current: Observation[] } {
  const baseSeed = modelType === 'fraud_detection' ? 1001 : 2002;
  const rngBaseline = new SeededRandom(baseSeed);

  const baselineCount = 10000;
  const currentCount = 5000;

  const baseline = generateObservations(baselineCount, 'baseline', modelType, 'stable', rngBaseline);

  // For stable current dataset, continue from same baseline distribution sequence so PSI is near 0.02
  const currentSeed = scenario === 'drifted' ? baseSeed + 9999 : baseSeed + 10;
  const rngCurrent = new SeededRandom(currentSeed);

  const current = generateObservations(currentCount, 'current', modelType, scenario, rngCurrent);

  return { baseline, current };
}

function generateObservations(
  count: number,
  period: 'baseline' | 'current',
  modelType: ModelType,
  scenario: ScenarioType,
  rng: SeededRandom
): Observation[] {
  const modelName = modelType === 'fraud_detection' ? 'Fraud Detection Model v2.4' : 'Service Prioritisation Model v1.8';
  const isDriftedScenario = period === 'current' && scenario === 'drifted';

  const observations: Observation[] = [];

  for (let i = 0; i < count; i++) {
    let txAmount: number;
    let txFreq: number;
    let accountAge: number;
    let customerRisk: number;
    let loginFreq: number;
    let deviceRisk: number;
    let geoRisk: number;
    let prevFraud: number;
    let serviceFreq: number;

    if (modelType === 'fraud_detection') {
      let amountMeanLog = 4.8; // e^4.8 ≈ $121
      let amountStdLog = 0.65;
      let loginMean = 14;
      let deviceRiskMean = 0.22;
      let geoRiskMean = 0.18;

      if (isDriftedScenario) {
        amountMeanLog = 5.4; // e^5.4 ≈ $221
        amountStdLog = 0.80;
        loginMean = 7.2;
        deviceRiskMean = 0.54;
        geoRiskMean = 0.38;
      }

      txAmount = Math.max(5, Math.round(rng.logNormal(amountMeanLog, amountStdLog) * 100) / 100);
      txFreq = Math.max(1, Math.min(50, Math.round(rng.normal(12, 3.5))));
      accountAge = Math.max(15, Math.min(3650, Math.round(rng.normal(1200, 450))));
      customerRisk = Math.max(0, Math.min(100, Math.round(rng.normal(32, 12))));
      loginFreq = Math.max(0, Math.round(rng.normal(loginMean, 3.5)));
      deviceRisk = Math.max(0, Math.min(1, Math.round(rng.normal(deviceRiskMean, 0.10) * 1000) / 1000));
      geoRisk = Math.max(0, Math.min(1, Math.round(rng.normal(geoRiskMean, 0.08) * 1000) / 1000));
      prevFraud = Math.max(0, rng.poisson(0.2));
      serviceFreq = Math.max(0, Math.min(30, Math.round(rng.normal(3.5, 1.5))));

    } else {
      let serviceFreqMean = 4.2;
      let customerRiskMean = 45;
      let loginMean = 18;

      if (isDriftedScenario) {
        serviceFreqMean = 9.8;
        customerRiskMean = 68;
        loginMean = 28;
      }

      txAmount = Math.max(10, Math.round(rng.logNormal(5.0, 0.5) * 100) / 100);
      txFreq = Math.max(1, Math.min(60, Math.round(rng.normal(18, 4))));
      accountAge = Math.max(20, Math.min(3650, Math.round(rng.normal(1400, 500))));
      customerRisk = Math.max(0, Math.min(100, Math.round(rng.normal(customerRiskMean, 12))));
      loginFreq = Math.max(0, Math.round(rng.normal(loginMean, 4)));
      deviceRisk = Math.max(0, Math.min(1, Math.round(rng.normal(0.15, 0.06) * 1000) / 1000));
      geoRisk = Math.max(0, Math.min(1, Math.round(rng.normal(0.12, 0.05) * 1000) / 1000));
      prevFraud = Math.max(0, rng.poisson(0.05));
      serviceFreq = Math.max(0, Math.min(50, Math.round(rng.normal(serviceFreqMean, 2.0))));
    }

    let riskLogit = -2.8;
    if (modelType === 'fraud_detection') {
      riskLogit += (txAmount / 300) * 0.8;
      riskLogit += deviceRisk * 2.8;
      riskLogit += geoRisk * 1.5;
      riskLogit += (customerRisk / 100) * 1.2;
      riskLogit += prevFraud * 0.9;
      if (loginFreq < 5) riskLogit += 0.8;
    } else {
      riskLogit += (serviceFreq / 10) * 1.6;
      riskLogit += (customerRisk / 100) * 1.4;
      riskLogit += (txFreq / 30) * 0.5;
    }

    const prob = 1 / (1 + Math.exp(-riskLogit));
    const predictionProb = Math.min(0.999, Math.max(0.001, Math.round(prob * 10000) / 10000));
    
    const predictionThreshold = modelType === 'fraud_detection' ? 0.42 : 0.50;
    const modelPrediction = predictionProb >= predictionThreshold ? 1 : 0;

    const baseDate = period === 'baseline' ? new Date('2026-06-01') : new Date('2026-09-01');
    const obsDate = new Date(baseDate.getTime() + Math.floor(rng.uniform(0, 30 * 24 * 3600 * 1000)));

    observations.push({
      id: `${period}_${modelType}_${i + 1}`,
      transaction_amount: txAmount,
      transaction_frequency: txFreq,
      account_age_days: accountAge,
      customer_risk_score: customerRisk,
      login_frequency: loginFreq,
      device_risk_score: deviceRisk,
      geographic_risk_score: geoRisk,
      previous_fraud_count: prevFraud,
      service_request_frequency: serviceFreq,
      model_prediction: modelPrediction,
      prediction_probability: predictionProb,
      timestamp: obsDate.toISOString(),
      model_name: modelName,
      monitoring_period: period
    });
  }

  return observations;
}
