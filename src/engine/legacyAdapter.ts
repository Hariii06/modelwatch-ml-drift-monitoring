import {
  ApiIngestionEnvelope,
  TransformationResult,
  Observation,
  ModelType,
  LegacyPredictionPayloadV1
} from '../types/monitoring';

export const LEGACY_FIELD_MAPPINGS: Record<string, string> = {
  tx_amt: 'transaction_amount',
  user_risk: 'customer_risk_score',
  score: 'prediction_probability',
  pred_label: 'model_prediction',
  device_score: 'device_risk_score',
  geo_score: 'geographic_risk_score',
  login_cnt: 'login_frequency',
  tx_cnt: 'transaction_frequency',
  account_age: 'account_age_days',
  prev_fraud: 'previous_fraud_count',
  svc_freq: 'service_request_frequency',
  record_id: 'id',
  timestamp_str: 'timestamp'
};

const SUPPORTED_VERSIONS = new Set(['v1_legacy', 'v2_modern']);

/**
 * Pure, deterministic adapter transforming versioned legacy prediction payloads
 * into standard canonical ModelWatch Observation objects.
 */
export function transformLegacyPayload(envelope: ApiIngestionEnvelope): TransformationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const observations: Observation[] = [];

  // 1. Version Validation
  if (!envelope || !envelope.version || typeof envelope.version !== 'string') {
    return {
      success: false,
      version: envelope?.version || 'missing',
      transformedCount: 0,
      observations: [],
      errors: ['Invalid API envelope: missing or non-string version identifier.'],
      warnings: [],
      fieldMappings: LEGACY_FIELD_MAPPINGS
    };
  }

  const version = envelope.version.trim();
  if (!SUPPORTED_VERSIONS.has(version)) {
    return {
      success: false,
      version,
      transformedCount: 0,
      observations: [],
      errors: [`Unsupported schema version '${version}'. Supported versions: v1_legacy, v2_modern.`],
      warnings: [],
      fieldMappings: LEGACY_FIELD_MAPPINGS
    };
  }

  // 2. Batch Validation
  if (!envelope.records || !Array.isArray(envelope.records) || envelope.records.length === 0) {
    return {
      success: false,
      version,
      transformedCount: 0,
      observations: [],
      errors: ['Empty batch: no prediction records provided in payload envelope.'],
      warnings: [],
      fieldMappings: LEGACY_FIELD_MAPPINGS
    };
  }

  const modelType: ModelType = envelope.modelType || 'fraud_detection';
  const period: 'baseline' | 'current' = envelope.monitoringPeriod || 'current';
  const modelName = modelType === 'fraud_detection' ? 'Fraud Detection Model v2.4 (Legacy Payload)' : 'Service Prioritisation Model v1.8 (Legacy Payload)';

  const processedIds = new Set<string>();

  // 3. Record-by-Record Transformation
  envelope.records.forEach((rawRec: LegacyPredictionPayloadV1, idx: number) => {
    const recordNum = idx + 1;
    if (!rawRec || typeof rawRec !== 'object') {
      errors.push(`Record #${recordNum}: Invalid record object.`);
      return;
    }

    // Extract ID (record_id or id)
    const rawId = rawRec.record_id || rawRec.id;
    const id = rawId ? String(rawId) : `legacy_obs_${Date.now()}_${recordNum}`;

    if (processedIds.has(id)) {
      warnings.push(`Record #${recordNum}: Duplicate record ID '${id}' detected. Appended index suffix.`);
    }
    processedIds.add(id);

    // Extract & Validate Timestamp (timestamp_str or timestamp)
    const rawTs = rawRec.timestamp_str || rawRec.timestamp;
    let isoTimestamp: string;
    if (rawTs) {
      const parsedTime = Date.parse(String(rawTs));
      if (isNaN(parsedTime)) {
        errors.push(`Record #${recordNum} (${id}): Invalid timestamp string '${rawTs}'.`);
        return;
      }
      isoTimestamp = new Date(parsedTime).toISOString();
    } else {
      isoTimestamp = new Date().toISOString();
      warnings.push(`Record #${recordNum} (${id}): Timestamp missing. Defaulted to current ISO time.`);
    }

    // Extract & Parse Transaction Amount (tx_amt or transaction_amount)
    const rawTxAmt = rawRec.tx_amt !== undefined ? rawRec.tx_amt : rawRec.transaction_amount;
    let txAmount: number | null = null;
    if (rawTxAmt !== null && rawTxAmt !== undefined && rawTxAmt !== '') {
      const num = typeof rawTxAmt === 'number' ? rawTxAmt : parseFloat(String(rawTxAmt));
      if (isNaN(num)) {
        errors.push(`Record #${recordNum} (${id}): Invalid numeric value for transaction amount '${rawTxAmt}'.`);
        return;
      }
      txAmount = Math.round(num * 100) / 100;
    }

    // Helper for numeric field parsing with fallback defaults
    const parseNumber = (
      val: any,
      fieldName: string,
      defaultVal: number
    ): number | null => {
      if (val === undefined || val === null || val === '') {
        return defaultVal;
      }
      const parsed = typeof val === 'number' ? val : parseFloat(String(val));
      if (isNaN(parsed)) {
        errors.push(`Record #${recordNum} (${id}): Invalid numeric string for '${fieldName}': '${val}'.`);
        return null;
      }
      return parsed;
    };

    const txFreq = parseNumber(rawRec.tx_cnt ?? rawRec.transaction_frequency, 'tx_cnt', 1);
    const accountAge = parseNumber(rawRec.account_age ?? rawRec.account_age_days, 'account_age', 365);
    const customerRisk = parseNumber(rawRec.user_risk ?? rawRec.customer_risk_score, 'user_risk', 30);
    const loginFreq = parseNumber(rawRec.login_cnt ?? rawRec.login_frequency, 'login_cnt', 10);
    const deviceRisk = parseNumber(rawRec.device_score ?? rawRec.device_risk_score, 'device_score', 0.2);
    const geoRisk = parseNumber(rawRec.geo_score ?? rawRec.geographic_risk_score, 'geo_score', 0.15);
    const prevFraud = parseNumber(rawRec.prev_fraud ?? rawRec.previous_fraud_count, 'prev_fraud', 0);
    const serviceFreq = parseNumber(rawRec.svc_freq ?? rawRec.service_request_frequency, 'svc_freq', 2);

    // Stop if any numeric field failed parsing
    if (
      txFreq === null ||
      accountAge === null ||
      customerRisk === null ||
      loginFreq === null ||
      deviceRisk === null ||
      geoRisk === null ||
      prevFraud === null ||
      serviceFreq === null
    ) {
      return;
    }

    // Extract & Validate Prediction Probability (score or prediction_probability)
    const rawScore = rawRec.score !== undefined ? rawRec.score : rawRec.prediction_probability;
    if (rawScore === undefined || rawScore === null || rawScore === '') {
      errors.push(`Record #${recordNum} (${id}): Missing required prediction probability score.`);
      return;
    }
    const score = typeof rawScore === 'number' ? rawScore : parseFloat(String(rawScore));
    if (isNaN(score) || score < 0.0 || score > 1.0) {
      errors.push(`Record #${recordNum} (${id}): Invalid prediction probability '${rawScore}'. Must be between 0.0 and 1.0.`);
      return;
    }

    // Extract & Validate Prediction Label (pred_label or model_prediction)
    const rawPred = rawRec.pred_label !== undefined ? rawRec.pred_label : rawRec.model_prediction;
    let predLabel: number;
    if (rawPred !== undefined && rawPred !== null && rawPred !== '') {
      const parsedPred = typeof rawPred === 'number' ? rawPred : parseInt(String(rawPred), 10);
      if (isNaN(parsedPred) || (parsedPred !== 0 && parsedPred !== 1)) {
        errors.push(`Record #${recordNum} (${id}): Invalid prediction label '${rawPred}'. Must be 0 or 1.`);
        return;
      }
      predLabel = parsedPred;
    } else {
      // Infer prediction label from score if label omitted
      predLabel = score >= 0.5 ? 1 : 0;
    }

    // Construct canonical Observation
    observations.push({
      id,
      transaction_amount: txAmount,
      transaction_frequency: txFreq,
      account_age_days: accountAge,
      customer_risk_score: customerRisk,
      login_frequency: loginFreq,
      device_risk_score: deviceRisk,
      geographic_risk_score: geoRisk,
      previous_fraud_count: prevFraud,
      service_request_frequency: serviceFreq,
      model_prediction: predLabel,
      prediction_probability: score,
      timestamp: isoTimestamp,
      model_name: modelName,
      monitoring_period: period
    });
  });

  const success = errors.length === 0 && observations.length > 0;

  return {
    success,
    version,
    transformedCount: observations.length,
    observations,
    errors,
    warnings,
    fieldMappings: LEGACY_FIELD_MAPPINGS
  };
}
