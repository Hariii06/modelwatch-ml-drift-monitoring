import React from 'react';
import { AlertDetail, ThresholdConfig } from '../types/monitoring';
import { ShieldAlert, AlertTriangle, ArrowRight, CheckCircle2, Info } from 'lucide-react';

interface AlertPanelProps {
  alerts: AlertDetail[];
  thresholds: ThresholdConfig;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, thresholds }) => {
  if (alerts.length === 0) {
    return (
      <div className="card" style={{ background: '#ECFDF5', borderColor: '#A7F3D0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#047857' }}>
          <CheckCircle2 size={20} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
            Model Behavior Stable — No Review Required
          </h3>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#065F46', marginTop: '0.35rem' }}>
          All feature PSI scores are below configured warning threshold ({thresholds.psiWarning.toFixed(2)}) and KS test p-values indicate no significant evidence of drift.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={alert.severity === 'RED' ? 'alert-card-red' : 'card'}
          style={alert.severity === 'AMBER' ? { background: '#FFFBEB', borderColor: '#FDE68A' } : undefined}
        >
          <div className="alert-header">
            {alert.severity === 'RED' ? <ShieldAlert size={22} /> : <AlertTriangle size={22} />}
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: alert.severity === 'RED' ? '#B91C1C' : '#B45309' }}>
                {alert.severity === 'RED' ? 'ACTION REQUIRED' : 'ADVISORY WARNING'}
              </div>
              <div>{alert.title}</div>
            </div>
          </div>

          <p style={{ fontSize: '0.84rem', color: alert.severity === 'RED' ? '#991B1B' : '#92400E', fontWeight: 500 }}>
            <strong>Trigger Reason:</strong> {alert.triggerReason}
          </p>

          <div className="alert-grid">
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Affected Feature(s)</span>
              <strong>{alert.affectedFeatures.length > 0 ? alert.affectedFeatures.join(', ') : 'Model Prediction Rate'}</strong>
            </div>

            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Drift Statistic</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{alert.driftStatistic}</strong>
            </div>

            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Configured Threshold</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{alert.configuredThreshold}</strong>
            </div>

            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Observed Value</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{alert.observedValue}</strong>
            </div>

            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Monitoring Window</span>
              <strong>{alert.monitoringPeriod}</strong>
            </div>
          </div>

          <div className="alert-action-box">
            <ArrowRight size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Suggested Operational Action:</strong> {alert.suggestedAction}
            </div>
          </div>

          <div style={{ fontSize: '0.74rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '0.5rem' }}>
            <Info size={13} />
            <span>
              <em>Note:</em> Statistical distribution shift detected. Operational risk assessment recommended before model outcome evaluation.
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
