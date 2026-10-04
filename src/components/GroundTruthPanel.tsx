import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Play,
  TrendingDown,
  Layers,
  ArrowRight,
  Database
} from 'lucide-react';
import { Observation, GroundTruthOutcome } from '../types/monitoring';
import {
  matchPredictionsToOutcomes,
  calculatePerformanceMetrics,
  calculateDelayMetrics
} from '../engine/outcomeEngine';
import { StoreAndForwardBuffer } from '../engine/bufferEngine';

interface GroundTruthPanelProps {
  currentPredictions: Observation[];
}

export const GroundTruthPanel: React.FC<GroundTruthPanelProps> = ({ currentPredictions }) => {
  const [activeScenario, setActiveScenario] = useState<'delayed' | 'degraded' | 'low_coverage' | 'buffer_failure'>('delayed');
  const [buffer] = useState(() => new StoreAndForwardBuffer(10, []));
  const [bufferStateTrigger, setBufferStateTrigger] = useState(0);

  // Generate deterministic synthetic ground-truth outcomes based on active scenario
  const outcomes: GroundTruthOutcome[] = useMemo(() => {
    if (!currentPredictions || currentPredictions.length === 0) return [];

    if (activeScenario === 'low_coverage') {
      // Return only 15% matched outcomes (low outcome coverage)
      const subsetCount = Math.floor(currentPredictions.length * 0.15);
      return currentPredictions.slice(0, subsetCount).map((p, idx) => ({
        record_id: p.id,
        actual_label: p.model_prediction, // high accuracy, low coverage
        outcome_timestamp: new Date(Date.parse(p.timestamp) + (5 + (idx % 10)) * 86400000).toISOString()
      }));
    }

    if (activeScenario === 'degraded') {
      // Simulate performance degradation: actual labels flip opposite to prediction for 45% of records
      return currentPredictions.map((p, idx) => {
        const isFlipped = idx % 2 === 0; // 50% accuracy drop
        return {
          record_id: p.id,
          actual_label: isFlipped ? (p.model_prediction === 1 ? 0 : 1) : p.model_prediction,
          outcome_timestamp: new Date(Date.parse(p.timestamp) + (14 + (idx % 20)) * 86400000).toISOString()
        };
      });
    }

    // Default / Delayed scenario: 85% matched outcomes arriving after 7-30 days delay
    const matchedCount = Math.floor(currentPredictions.length * 0.85);
    return currentPredictions.slice(0, matchedCount).map((p, idx) => ({
      record_id: p.id,
      actual_label: idx % 12 === 0 ? (p.model_prediction === 1 ? 0 : 1) : p.model_prediction, // High 91% accuracy
      outcome_timestamp: new Date(Date.parse(p.timestamp) + (7 + (idx % 23)) * 86400000).toISOString()
    }));
  }, [currentPredictions, activeScenario]);

  // Compute matching and metrics
  const matchResult = useMemo(() => {
    return matchPredictionsToOutcomes(currentPredictions, outcomes);
  }, [currentPredictions, outcomes]);

  const performance = useMemo(() => {
    return calculatePerformanceMetrics(matchResult, currentPredictions.length);
  }, [matchResult, currentPredictions]);

  const delayMetrics = useMemo(() => {
    return calculateDelayMetrics(matchResult.matchedPairs);
  }, [matchResult]);

  const bufferState = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    bufferStateTrigger; // recompute dependency
    return buffer.getQueueState();
  }, [buffer, bufferStateTrigger]);

  const refreshBuffer = () => setBufferStateTrigger(prev => prev + 1);

  // Ingestion failure simulation handlers
  const handleEnqueueDemoBatch = () => {
    buffer.enqueueBatch(currentPredictions.slice(0, 50));
    refreshBuffer();
  };

  const handleSimulateFailure = () => {
    const queue = buffer.getQueue();
    if (queue.length === 0) {
      handleEnqueueDemoBatch();
    }
    const latest = buffer.getQueue()[0];
    if (latest) {
      buffer.simulateIngestion(latest.batch_id, true);
      refreshBuffer();
    }
  };

  const handleRetryFailed = () => {
    buffer.retryFailedBatches();
    const queue = buffer.getQueue();
    queue.forEach(b => {
      if (b.status === 'retrying') {
        buffer.simulateIngestion(b.batch_id, false);
      }
    });
    refreshBuffer();
  };

  const handleFlushProcessed = () => {
    buffer.flushProcessed();
    refreshBuffer();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Overview & Scenario Bar */}
      <div className="card" style={{ background: 'var(--navy-900)', border: '1px solid var(--navy-700)', color: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <ShieldCheck size={20} color="#0EA5E9" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                Delayed Ground-Truth Outcome & Performance Engine
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.4 }}>
              Evaluates model accuracy, F1 score, and ROC-AUC decay as delayed ground-truth chargebacks arrive asynchronously post-deployment.
            </p>
          </div>

          {/* Scenario Selectors */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              className={`btn-scenario ${activeScenario === 'delayed' ? 'active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              onClick={() => setActiveScenario('delayed')}
            >
              Delayed Outcomes (Normal)
            </button>
            <button
              className={`btn-scenario ${activeScenario === 'degraded' ? 'active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', borderColor: activeScenario === 'degraded' ? '#EF4444' : undefined }}
              onClick={() => setActiveScenario('degraded')}
            >
              Performance Degradation (F1 Drop)
            </button>
            <button
              className={`btn-scenario ${activeScenario === 'low_coverage' ? 'active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', borderColor: activeScenario === 'low_coverage' ? '#F59E0B' : undefined }}
              onClick={() => setActiveScenario('low_coverage')}
            >
              Low Outcome Coverage (15%)
            </button>
            <button
              className={`btn-scenario ${activeScenario === 'buffer_failure' ? 'active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              onClick={() => {
                setActiveScenario('buffer_failure');
                handleSimulateFailure();
              }}
            >
              Store & Forward Retry Demo
            </button>
          </div>
        </div>
      </div>

      {/* Outcome Governance Alerts */}
      {performance.outcomeCoveragePercent < 50 && (
        <div className="card" style={{ background: '#FFFBEB', borderLeft: '4px solid #F59E0B', color: '#B45309', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="#D97706" />
            <div>
              <strong>GOVERNANCE WARNING — LOW OUTCOME COVERAGE ({performance.outcomeCoveragePercent}%):</strong> Ground-truth confirmation coverage is below the required 50% threshold. Evaluated on {performance.matchedCount} / {performance.totalPredictions} records. High latency or unconfirmed transaction volume detected.
            </div>
          </div>
        </div>
      )}

      {activeScenario === 'degraded' && (
        <div className="card" style={{ background: '#FEF2F2', borderLeft: '4px solid #EF4444', color: '#991B1B', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingDown size={18} color="#DC2626" />
            <div>
              <strong>CRITICAL ALARM — MODEL PERFORMANCE DEGRADATION DETECTED:</strong> F1-Score degraded to {performance.f1Score} (Accuracy: {(performance.accuracy * 100).toFixed(1)}%). Ground-truth actual chargeback labels reveal substantial false positive/negative classification divergence post-drift. Retraining recommended.
            </div>
          </div>
        </div>
      )}

      {/* Metrics Overview Grid */}
      <div className="summary-cards-grid">
        <div className="card kpi-card">
          <div className="kpi-label">Outcome Coverage</div>
          <div className="kpi-value" style={{ color: performance.outcomeCoveragePercent >= 50 ? '#059669' : '#D97706' }}>
            {performance.outcomeCoveragePercent}%
          </div>
          <div className="kpi-subtext">
            {performance.matchedCount} Matched / {performance.unmatchedCount} Pending
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-label">F1-Score</div>
          <div className="kpi-value" style={{ color: performance.f1Score >= 0.75 ? '#059669' : '#DC2626' }}>
            {performance.f1Score}
          </div>
          <div className="kpi-subtext">
            Precision: {performance.precision} | Recall: {performance.recall}
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-label">ROC-AUC Score</div>
          <div className="kpi-value" style={{ color: '#0EA5E9' }}>
            {performance.rocAuc !== null ? performance.rocAuc : 'N/A'}
          </div>
          <div className="kpi-subtext">
            {performance.rocAucExplanation || `Computed over ${performance.matchedCount} pairs`}
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-label">Average Outcome Delay</div>
          <div className="kpi-value" style={{ color: '#6366F1' }}>
            {delayMetrics.avgDelayDays} Days
          </div>
          <div className="kpi-subtext">
            Range: {delayMetrics.minDelayDays} – {delayMetrics.maxDelayDays} days
          </div>
        </div>
      </div>

      {/* Confusion Matrix & Detailed Metrics Split */}
      <div className="section-grid section-grid-split">
        {/* Confusion Matrix Card */}
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={18} color="var(--accent-blue)" /> Matched Confusion Matrix
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.85rem', borderRadius: 8 }}>
              <div style={{ fontSize: '0.74rem', color: '#065F46', fontWeight: 600 }}>TRUE POSITIVES (TP)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857', marginTop: '0.2rem' }}>{performance.truePositives}</div>
              <div style={{ fontSize: '0.7rem', color: '#047857' }}>Correctly Flagged Fraud</div>
            </div>

            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '0.85rem', borderRadius: 8 }}>
              <div style={{ fontSize: '0.74rem', color: '#991B1B', fontWeight: 600 }}>FALSE POSITIVES (FP)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#B91C1C', marginTop: '0.2rem' }}>{performance.falsePositives}</div>
              <div style={{ fontSize: '0.7rem', color: '#B91C1C' }}>False Alarms (Customer Friction)</div>
            </div>

            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '0.85rem', borderRadius: 8 }}>
              <div style={{ fontSize: '0.74rem', color: '#991B1B', fontWeight: 600 }}>FALSE NEGATIVES (FN)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#B91C1C', marginTop: '0.2rem' }}>{performance.falseNegatives}</div>
              <div style={{ fontSize: '0.7rem', color: '#B91C1C' }}>Missed Fraud (Financial Loss)</div>
            </div>

            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '0.85rem', borderRadius: 8 }}>
              <div style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 600 }}>TRUE NEGATIVES (TN)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803D', marginTop: '0.2rem' }}>{performance.trueNegatives}</div>
              <div style={{ fontSize: '0.7rem', color: '#15803D' }}>Correct Genuine Transactions</div>
            </div>
          </div>
        </div>

        {/* Store-and-Forward Buffering Telemetry */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={18} color="var(--accent-blue)" /> Store & Forward Ingestion Buffer
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748B', background: '#F1F5F9', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
              FIFO Queue (Max {bufferState.maxCapacity} Batches)
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
            <button className="btn-secondary" style={{ fontSize: '0.76rem', padding: '0.3rem 0.6rem' }} onClick={handleEnqueueDemoBatch}>
              Enqueue Prediction Batch
            </button>
            <button className="btn-secondary" style={{ fontSize: '0.76rem', padding: '0.3rem 0.6rem', color: '#DC2626' }} onClick={handleSimulateFailure}>
              Simulate 503 Ingestion Failure
            </button>
            <button className="btn-secondary" style={{ fontSize: '0.76rem', padding: '0.3rem 0.6rem', color: '#059669' }} onClick={handleRetryFailed}>
              <RefreshCw size={12} /> Retry Failed Batches
            </button>
            <button className="btn-secondary" style={{ fontSize: '0.76rem', padding: '0.3rem 0.6rem' }} onClick={handleFlushProcessed}>
              <Trash2 size={12} /> Flush Processed
            </button>
          </div>

          {/* Queue Items List */}
          <div style={{ background: '#0F172A', borderRadius: 6, padding: '0.65rem', maxHeight: 180, overflowY: 'auto' }}>
            {bufferState.batches.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: '0.78rem', textAlign: 'center', padding: '1rem' }}>
                Store & Forward Queue empty (0 buffered batches).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {bufferState.batches.map(b => (
                  <div key={b.batch_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', background: '#1E293B', padding: '0.4rem 0.6rem', borderRadius: 4, color: '#F8FAFC' }}>
                    <div>
                      <strong style={{ color: '#38BDF8' }}>{b.batch_id}</strong> ({b.batch_size} records)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {b.status === 'processed' && <span style={{ color: '#34D399', fontWeight: 600 }}>PROCESSED</span>}
                      {b.status === 'failed' && <span style={{ color: '#F87171', fontWeight: 600 }}>FAILED (Retry #{b.retry_count})</span>}
                      {b.status === 'retrying' && <span style={{ color: '#FBBF24', fontWeight: 600 }}>RETRYING...</span>}
                      {b.status === 'pending' && <span style={{ color: '#94A3B8' }}>PENDING</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
