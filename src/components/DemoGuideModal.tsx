import React from 'react';
import { HelpCircle, X, Clock, CheckCircle } from 'lucide-react';

interface DemoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoGuideModal: React.FC<DemoGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HelpCircle size={22} color="var(--accent-blue)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-900)' }}>
              3-Minute Executive Presentation Script & Demo Guide
            </h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
          {/* Timeline Item 1 */}
          <div style={{ background: '#F8FAFC', borderLeft: '4px solid var(--accent-blue)', padding: '0.85rem', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--navy-900)' }}>
              <Clock size={16} color="var(--accent-blue)" /> 0:00 – 0:30: Framing the Problem
            </div>
            <p style={{ marginTop: '0.35rem', color: 'var(--navy-700)' }}>
              "Bank ML models degrade silently post-deployment because customer behavior shifts over time. Without automated monitoring, fraud and risk teams have no empirical trigger for model review. ModelWatch solves this by continuously monitoring feature and prediction drift."
            </p>
          </div>

          {/* Timeline Item 2 */}
          <div style={{ background: '#F8FAFC', borderLeft: '4px solid var(--accent-blue)', padding: '0.85rem', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--navy-900)' }}>
              <Clock size={16} color="var(--accent-blue)" /> 0:30 – 1:00: Baseline vs Current Setup
            </div>
            <p style={{ marginTop: '0.35rem', color: 'var(--navy-700)' }}>
              "Point out the persistent 10,000 baseline observations dataset compared against the 5,000 current monitoring window across 9 core banking variables (e.g. transaction_amount, device_risk_score)."
            </p>
          </div>

          {/* Timeline Item 3 */}
          <div style={{ background: '#F8FAFC', borderLeft: '4px solid #10B981', padding: '0.85rem', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#047857' }}>
              <Clock size={16} color="#10B981" /> 1:00 – 1:45: Run Stable Scenario A
            </div>
            <p style={{ marginTop: '0.35rem', color: 'var(--navy-700)' }}>
              "Click 'Scenario A: Stable Baseline'. Show that all PSI scores remain below 0.10, status badge is GREEN, and zero false-positive review alerts are raised."
            </p>
          </div>

          {/* Timeline Item 4 */}
          <div style={{ background: '#F8FAFC', borderLeft: '4px solid #EF4444', padding: '0.85rem', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#B91C1C' }}>
              <Clock size={16} color="#EF4444" /> 1:45 – 2:30: Run Drifted Scenario B & Inspect Alerts
            </div>
            <p style={{ marginTop: '0.35rem', color: 'var(--navy-700)' }}>
              "Click 'Scenario B: Drifted Features'. Point out that transaction_amount PSI reached 0.27, triggering a 'REVIEW RECOMMENDED' alert. Show the distribution histogram chart comparing baseline vs current."
            </p>
          </div>

          {/* Timeline Item 5 */}
          <div style={{ background: '#F8FAFC', borderLeft: '4px solid #F59E0B', padding: '0.85rem', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#B45309' }}>
              <Clock size={16} color="#F59E0B" /> 2:30 – 3:00: Edge Cases & Automated Diagnostic Suite
            </div>
            <p style={{ marginTop: '0.35rem', color: 'var(--navy-700)' }}>
              "Demonstrate Test Case 1 (18% Missing Data) and Test Case 2 (Outliers). Open the Diagnostic Test Suite tab showing 8/8 PASS assertions. Conclude by highlighting system resilience and stakeholder validation workflows."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
