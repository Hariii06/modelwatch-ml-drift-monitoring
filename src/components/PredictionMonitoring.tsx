import React from 'react';
import { PredictionMetrics } from '../types/monitoring';
import { Activity, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';

interface PredictionMonitoringProps {
  metrics: PredictionMetrics;
}

export const PredictionMonitoring: React.FC<PredictionMonitoringProps> = ({ metrics }) => {
  const isPositiveShift = metrics.rateChangePercent > 0;
  const isWarning = metrics.status === 'RED' || metrics.status === 'AMBER';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)' }}>
              Prediction Distribution & Behavior Monitoring
            </h3>
            <span className="badge-phase2">Outcome Verification Pending</span>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--navy-600)' }}>
            Output-level probability shift analysis comparing model decision volume.
          </p>
        </div>

        <span className={`badge-status ${metrics.status === 'RED' ? 'badge-red' : metrics.status === 'AMBER' ? 'badge-amber' : 'badge-green'}`}>
          {metrics.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--navy-600)', textTransform: 'uppercase' }}>
            Baseline Positive Rate
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--navy-900)', fontFamily: 'var(--font-mono)' }}>
            {metrics.baselinePositiveRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--navy-600)' }}>Historical baseline</div>
        </div>

        <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--navy-600)', textTransform: 'uppercase' }}>
            Current Positive Rate
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: isWarning ? '#DC2626' : 'var(--navy-900)', fontFamily: 'var(--font-mono)' }}>
            {metrics.currentPositiveRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.72rem', color: isPositiveShift ? '#DC2626' : '#047857', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
            {isPositiveShift ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {metrics.rateChangePercent > 0 ? '+' : ''}{metrics.rateChangePercent.toFixed(1)}% shift
          </div>
        </div>

        <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--navy-600)', textTransform: 'uppercase' }}>
            Avg Probability
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--navy-900)', fontFamily: 'var(--font-mono)' }}>
            {metrics.baselineAvgProb.toFixed(3)} &rarr; {metrics.currentAvgProb.toFixed(3)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--navy-600)' }}>Probability PSI: {metrics.probabilityPsi.toFixed(3)}</div>
        </div>
      </div>

      <div style={{ background: '#EFF6FF', padding: '0.75rem 0.9rem', borderRadius: 6, fontSize: '0.78rem', color: '#1E40AF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <Info size={16} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <strong>Prediction Monitoring Scope:</strong> Evaluates live changes in output prediction frequency. Downstream financial loss metrics are verified as ground-truth outcome data becomes available.
        </div>
      </div>
    </div>
  );
};
