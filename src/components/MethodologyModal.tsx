import React from 'react';
import { BookOpen, X, Calculator, ShieldCheck, AlertCircle } from 'lucide-react';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MethodologyModal: React.FC<MethodologyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={22} color="var(--accent-blue)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-900)' }}>
              Statistical Drift Methodology & Threshold Reference
            </h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--navy-800)' }}>
          {/* Baseline Definition */}
          <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.35rem' }}>
              1. What is a Baseline Population?
            </h3>
            <p>
              In model monitoring, the <strong>baseline dataset</strong> represents a stable reference period — typically the training/validation data or the initial post-deployment window (e.g. 10,000 observations). The baseline remains persistent during monitoring so current production windows (e.g. 5,000 observations) can be systematically compared against it.
            </p>
          </div>

          {/* PSI Section */}
          <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calculator size={16} color="var(--accent-blue)" />
              2. Population Stability Index (PSI)
            </h3>
            <p style={{ marginBottom: '0.5rem' }}>
              PSI measures how much a variable distribution has shifted between baseline proportions (A_i) and current proportions (E_i) across 10 quantile bins:
            </p>

            <div style={{ background: '#0F172A', color: '#38BDF8', padding: '0.75rem', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.82rem', textAlign: 'center' }}>
              {"PSI = \\sum_{i=1}^{k} (E_i - A_i) \\times \\ln(E_i / A_i)"}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginTop: '0.75rem', textAlign: 'center' }}>
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.5rem', borderRadius: 6 }}>
                <strong style={{ color: '#047857' }}>PSI &lt; 0.10</strong>
                <div style={{ fontSize: '0.74rem', color: '#065F46' }}>Stable Population</div>
              </div>
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '0.5rem', borderRadius: 6 }}>
                <strong style={{ color: '#B45309' }}>0.10 &le; PSI &lt; 0.20</strong>
                <div style={{ fontSize: '0.74rem', color: '#92400E' }}>Moderate Warning</div>
              </div>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '0.5rem', borderRadius: 6 }}>
                <strong style={{ color: '#B91C1C' }}>PSI &ge; 0.20</strong>
                <div style={{ fontSize: '0.74rem', color: '#991B1B' }}>Significant Drift</div>
              </div>
            </div>
          </div>

          {/* KS Statistic */}
          <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '0.35rem' }}>
              3. Kolmogorov-Smirnov (KS) Statistic & p-Value
            </h3>
            <p style={{ marginBottom: '0.5rem' }}>
              The KS test quantifies the maximum distance D between the Empirical Cumulative Distribution Functions (ECDF) of baseline F1(x) and current F2(x):
            </p>
            <div style={{ background: '#0F172A', color: '#38BDF8', padding: '0.6rem', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.82rem', textAlign: 'center' }}>
              {"D = \\sup_x |F_{1,n1}(x) - F_{2,n2}(x)|"}
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '0.5rem' }}>
              If asymptotic $p$-value &lt; 0.05, we reject the null hypothesis of equal distributions, signaling potential feature drift.
            </p>
          </div>

          {/* Feature Drift vs Performance Degradation */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1rem', borderRadius: 8, color: '#1E40AF' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={18} />
              4. Feature Drift vs. Model Performance Loss
            </h3>
            <p>
              <strong>Crucial Distinction:</strong> Detecting feature or prediction distribution drift does <em>not</em> automatically prove financial or fraud accuracy degradation.
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              Model performance evaluation (F1-score, Precision, Recall, Financial Loss Limits) requires ground-truth outcome data (e.g. 30-90 day chargeback confirmations). ModelWatch acts as an early-warning signal alerting teams to investigate before operational harm occurs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
