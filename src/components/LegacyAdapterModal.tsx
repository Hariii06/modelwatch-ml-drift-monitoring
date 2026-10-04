import React, { useState } from 'react';
import { Database, X, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Code } from 'lucide-react';
import { transformLegacyPayload, LEGACY_FIELD_MAPPINGS } from '../engine/legacyAdapter';
import { TransformationResult } from '../types/monitoring';

interface LegacyAdapterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_VALID_PAYLOAD = JSON.stringify(
  {
    version: 'v1_legacy',
    modelType: 'fraud_detection',
    records: [
      {
        record_id: 'leg_tx_9011',
        tx_amt: '420.50',
        user_risk: 72,
        score: '0.89',
        pred_label: 1,
        device_score: 0.65,
        geo_score: 0.40,
        login_cnt: 4,
        timestamp_str: '2026-09-18T10:15:00Z'
      },
      {
        record_id: 'leg_tx_9012',
        tx_amt: '115.00',
        user_risk: 18,
        score: '0.04',
        pred_label: 0,
        device_score: 0.12,
        geo_score: 0.08,
        login_cnt: 15,
        timestamp_str: '2026-09-18T10:18:00Z'
      }
    ]
  },
  null,
  2
);

const SAMPLE_INVALID_PAYLOAD = JSON.stringify(
  {
    version: 'v1_legacy',
    records: [
      {
        record_id: 'bad_tx_01',
        tx_amt: 'not_a_number',
        score: 1.75, // Invalid probability > 1.0
        pred_label: 99 // Invalid label
      }
    ]
  },
  null,
  2
);

export const LegacyAdapterModal: React.FC<LegacyAdapterModalProps> = ({ isOpen, onClose }) => {
  const [jsonText, setJsonText] = useState<string>(SAMPLE_VALID_PAYLOAD);
  const [result, setResult] = useState<TransformationResult | null>(() => {
    try {
      return transformLegacyPayload(JSON.parse(SAMPLE_VALID_PAYLOAD));
    } catch {
      return null;
    }
  });

  if (!isOpen) return null;

  const handleTransform = (textToParse: string) => {
    try {
      const parsed = JSON.parse(textToParse);
      const res = transformLegacyPayload(parsed);
      setResult(res);
    } catch (err: any) {
      setResult({
        success: false,
        version: 'json_parse_error',
        transformedCount: 0,
        observations: [],
        errors: [`JSON Syntax Error: ${err.message}`],
        warnings: [],
        fieldMappings: LEGACY_FIELD_MAPPINGS
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 850 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={22} color="var(--accent-blue)" />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                Legacy API Payload Coexistence Adapter (v1_legacy)
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
                Demonstrates schema normalization mapping legacy prediction payloads into canonical Observation format.
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.84rem' }}>
          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Presets:</span>
            <button
              className="btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
              onClick={() => {
                setJsonText(SAMPLE_VALID_PAYLOAD);
                handleTransform(SAMPLE_VALID_PAYLOAD);
              }}
            >
              Load Valid v1_legacy Batch
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', color: '#B45309' }}
              onClick={() => {
                setJsonText(SAMPLE_INVALID_PAYLOAD);
                handleTransform(SAMPLE_INVALID_PAYLOAD);
              }}
            >
              Load Invalid Payload (Test Validation)
            </button>
          </div>

          {/* Code Editor & Live Adapter Output Split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Input JSON Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: 600, color: 'var(--navy-900)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Code size={14} color="#0EA5E9" /> External Legacy Payload JSON Envelope
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  handleTransform(e.target.value);
                }}
                style={{
                  width: '100%',
                  height: 280,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.76rem',
                  padding: '0.6rem',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  background: '#0F172A',
                  color: '#94A3B8',
                  resize: 'none'
                }}
              />
            </div>

            {/* Adapter Output Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--navy-900)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                Adapter Transformation Output <ArrowRight size={14} color="#0EA5E9" />
              </div>

              {result && (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.75rem', borderRadius: 6, height: 280, overflowY: 'auto' }}>
                  {/* Status Banner */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem', padding: '0.4rem 0.6rem', borderRadius: 4, background: result.success ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${result.success ? '#A7F3D0' : '#FECACA'}` }}>
                    {result.success ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#DC2626" />}
                    <span style={{ fontWeight: 700, fontSize: '0.78rem', color: result.success ? '#047857' : '#B91C1C' }}>
                      {result.success ? `SUCCESS (${result.transformedCount} Records Transformed)` : `VALIDATION REJECTED (${result.errors.length} Errors)`}
                    </span>
                  </div>

                  {/* Schema Info */}
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginBottom: '0.5rem' }}>
                    <strong>Detected Version:</strong> <code style={{ background: '#E2E8F0', padding: '0.1rem 0.3rem', borderRadius: 3 }}>{result.version}</code>
                  </div>

                  {/* Errors */}
                  {result.errors.length > 0 && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#B91C1C', fontSize: '0.76rem' }}>Validation Errors:</strong>
                      <ul style={{ margin: '0.2rem 0 0 1rem', color: '#DC2626', fontSize: '0.74rem' }}>
                        {result.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {result.warnings.length > 0 && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#D97706', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <AlertTriangle size={12} /> Warnings:
                      </strong>
                      <ul style={{ margin: '0.2rem 0 0 1rem', color: '#B45309', fontSize: '0.74rem' }}>
                        {result.warnings.map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Transformed Sample Output */}
                  {result.observations.length > 0 && (
                    <div>
                      <strong style={{ color: '#047857', fontSize: '0.76rem' }}>Transformed Canonical Observation sample:</strong>
                      <pre style={{ background: '#0F172A', color: '#38BDF8', padding: '0.5rem', borderRadius: 4, fontSize: '0.72rem', marginTop: '0.2rem', overflowX: 'auto' }}>
                        {JSON.stringify(result.observations[0], null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Field Mappings Reference */}
          <div style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '0.65rem 0.85rem', borderRadius: 6 }}>
            <strong style={{ fontSize: '0.78rem', color: 'var(--navy-900)' }}>v1_legacy Schema Field Translation Map:</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem 0.75rem', marginTop: '0.4rem', fontSize: '0.74rem', color: '#475569' }}>
              <div><code>tx_amt</code> &rarr; <code>transaction_amount</code></div>
              <div><code>user_risk</code> &rarr; <code>customer_risk_score</code></div>
              <div><code>score</code> &rarr; <code>prediction_probability</code></div>
              <div><code>pred_label</code> &rarr; <code>model_prediction</code></div>
              <div><code>device_score</code> &rarr; <code>device_risk_score</code></div>
              <div><code>geo_score</code> &rarr; <code>geographic_risk_score</code></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
