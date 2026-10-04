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

/**
 * Legacy v1 API prediction payload structure representing historical/external batch formats
 */
export interface LegacyPredictionPayloadV1 {
  record_id?: string;
  tx_amt?: number | string | null;
  tx_cnt?: number | string;
  account_age?: number | string;
  user_risk?: number | string;
  login_cnt?: number | string;
  device_score?: number | string;
  geo_score?: number | string;
  prev_fraud?: number | string;
  svc_freq?: number | string;
  pred_label?: number | string;
  score?: number | string;
  timestamp_str?: string;
  [key: string]: any;
}

/**
 * Envelope container for versioned API batch ingestion requests
 */
export interface ApiIngestionEnvelope {
  version: 'v1_legacy' | 'v2_modern' | string;
  modelType?: ModelType;
  monitoringPeriod?: 'baseline' | 'current';
  records: any[];
}

/**
 * Detailed transformation result returned by versioned payload adapters
 */
export interface TransformationResult {
  success: boolean;
  version: string;
  transformedCount: number;
  observations: Observation[];
  errors: string[];
  warnings: string[];
  fieldMappings: Record<string, string>;
}

/**
 * Delayed real-world ground-truth outcome label record
 */
export interface GroundTruthOutcome {
  record_id: string;
  actual_label: number; // 0 or 1 (e.g., actual fraud chargeback confirmed)
  outcome_timestamp: string; // ISO 8601 timestamp when outcome confirmed
  delay_days?: number;
  metadata?: Record<string, any>;
}

/**
 * Store-and-forward prediction batch held in client ingestion buffer
 */
export interface BufferedBatch {
  batch_id: string;
  observations: Observation[];
  ingested_at: string;
  status: 'pending' | 'retrying' | 'processed' | 'failed';
  retry_count: number;
  last_attempt_at?: string;
  error?: string;
  batch_size: number;
}

/**
 * Matched prediction-to-outcome evaluation pair
 */
export interface MatchedPair {
  prediction: Observation;
  outcome: GroundTruthOutcome;
  delayDays: number;
}

/**
 * Result of matching predictions to delayed ground-truth outcomes
 */
export interface OutcomeMatchResult {
  matchedPairs: MatchedPair[];
  unmatchedPredictions: Observation[];
  unmatchedOutcomes: GroundTruthOutcome[];
  duplicateOutcomes: string[];
  validationErrors: string[];
}

/**
 * Ground-truth evaluation metrics (Confusion Matrix, Precision/Recall/F1, ROC-AUC)
 */
export interface PerformanceMetrics {
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number | null;
  rocAucExplanation?: string;
  matchedCount: number;
  unmatchedCount: number;
  totalPredictions: number;
  outcomeCoveragePercent: number;
}

/**
 * Aggregated latency/delay statistics for confirmed ground-truth outcomes
 */
export interface DelayMetrics {
  matchedCount: number;
  avgDelayDays: number;
  minDelayDays: number;
  maxDelayDays: number;
}

/**
 * Snapshot of client-side Store-and-Forward Buffer queue state
 */
export interface BufferQueueState {
  batches: BufferedBatch[];
  pendingCount: number;
  failedCount: number;
  processedCount: number;
  totalBufferedRecords: number;
  maxCapacity: number;
}


