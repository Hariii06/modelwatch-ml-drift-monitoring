import {
  ApiIngestionEnvelope,
  Observation,
  GroundTruthOutcome
} from '../types/monitoring';
import { transformLegacyPayload } from './legacyAdapter';
import { matchPredictionsToOutcomes } from './outcomeEngine';

export interface ApiResponse<T> {
  status: number;
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string[];
  };
  headers: Record<string, string>;
}

export interface IngestionOptions {
  simulateUnavailable?: boolean;
}

const COMMON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-ModelWatch-Version': 'v1.0.0',
  'X-RateLimit-Limit': '1000'
};

/**
 * Client-Side REST API Mock Service
 * Simulates asynchronous HTTP endpoint ingestion (/api/v1/predict, /api/v1/outcomes, /api/v1/health)
 * with structured status codes (200, 400, 422, 503) and response metadata.
 */

/**
 * POST /api/v1/predict
 * Ingests and normalizes prediction batch envelopes
 */
export async function postPredictionBatch(
  envelope: ApiIngestionEnvelope,
  options?: IngestionOptions
): Promise<ApiResponse<{ transformedCount: number; observations: Observation[] }>> {
  // 1. Check 503 Service Unavailable simulation
  if (options?.simulateUnavailable) {
    return {
      status: 503,
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Downstream prediction ingestion service is temporarily unavailable (HTTP 503).'
      },
      headers: { ...COMMON_HEADERS, 'Retry-After': '30' }
    };
  }

  // 2. Check 400 Bad Request for missing envelope / non-object payload
  if (!envelope || typeof envelope !== 'object') {
    return {
      status: 400,
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed request payload: envelope must be a valid JSON object.'
      },
      headers: COMMON_HEADERS
    };
  }

  // 3. Transform & validate payload using versioned legacy adapter
  const result = transformLegacyPayload(envelope);

  // 4. Handle 422 Validation Error for invalid values
  if (!result.success) {
    const isUnsupportedVersion = result.errors.some(e => e.includes('Unsupported schema version'));
    return {
      status: isUnsupportedVersion ? 400 : 422,
      success: false,
      error: {
        code: isUnsupportedVersion ? 'INVALID_VERSION' : 'UNPROCESSABLE_ENTITY',
        message: isUnsupportedVersion
          ? `Unsupported API schema version '${result.version}'.`
          : 'Prediction batch validation failed.',
        details: result.errors
      },
      headers: COMMON_HEADERS
    };
  }

  // 5. 200 OK Successful Response
  return {
    status: 200,
    success: true,
    data: {
      transformedCount: result.transformedCount,
      observations: result.observations
    },
    headers: COMMON_HEADERS
  };
}

/**
 * POST /api/v1/outcomes
 * Ingests delayed real-world ground-truth chargeback/outcome records
 */
export async function postOutcomeBatch(
  outcomes: GroundTruthOutcome[],
  options?: IngestionOptions
): Promise<ApiResponse<{ matchedCount: number; validationErrors: string[] }>> {
  if (options?.simulateUnavailable) {
    return {
      status: 503,
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Outcome processing endpoint is temporarily offline (HTTP 503).'
      },
      headers: { ...COMMON_HEADERS, 'Retry-After': '60' }
    };
  }

  if (!outcomes || !Array.isArray(outcomes)) {
    return {
      status: 400,
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed request payload: outcomes must be an array.'
      },
      headers: COMMON_HEADERS
    };
  }

  if (outcomes.length === 0) {
    return {
      status: 400,
      success: false,
      error: {
        code: 'EMPTY_BATCH',
        message: 'Empty outcome batch submitted.'
      },
      headers: COMMON_HEADERS
    };
  }

  // Validate individual outcome items
  const validationErrors: string[] = [];
  outcomes.forEach((o, i) => {
    if (!o || typeof o !== 'object' || !o.record_id) {
      validationErrors.push(`Outcome #${i + 1}: Missing record_id.`);
    } else if (o.actual_label !== 0 && o.actual_label !== 1) {
      validationErrors.push(`Outcome #${i + 1} (${o.record_id}): Invalid actual_label '${o.actual_label}'. Must be 0 or 1.`);
    }
  });

  if (validationErrors.length > 0) {
    return {
      status: 422,
      success: false,
      error: {
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Outcome validation errors encountered.',
        details: validationErrors
      },
      headers: COMMON_HEADERS
    };
  }

  return {
    status: 200,
    success: true,
    data: {
      matchedCount: outcomes.length,
      validationErrors: []
    },
    headers: COMMON_HEADERS
  };
}

/**
 * GET /api/v1/health
 * Returns mock system health and uptime metadata
 */
export async function getHealthStatus(): Promise<
  ApiResponse<{ status: 'healthy' | 'degraded'; uptimeSeconds: number; version: string }>
> {
  return {
    status: 200,
    success: true,
    data: {
      status: 'healthy',
      uptimeSeconds: Math.floor(performance.now() / 1000),
      version: 'v1.0.0'
    },
    headers: COMMON_HEADERS
  };
}
