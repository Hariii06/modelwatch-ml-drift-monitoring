import React, { useState } from 'react';
import { StakeholderFeedback } from '../types/monitoring';
import { MessageSquareText, CheckCircle2, Send, Info, Star } from 'lucide-react';

const INITIAL_FEEDBACK: StakeholderFeedback[] = [
  {
    id: 'syn_1',
    role: 'Lead ML Engineer (Credit & Fraud Risk)',
    problemClear: true,
    alertUnderstandable: true,
    featureIdentified: true,
    helpfulForDecision: true,
    comments: 'The PSI breakdown per feature and prediction probability drift histogram immediately pinpointed our transaction_amount shift without wasting hours running manual Jupyter scripts.',
    timestamp: '2026-09-07 14:30',
    isSynthetic: true
  },
  {
    id: 'syn_2',
    role: 'Fraud Operations Manager',
    problemClear: true,
    alertUnderstandable: true,
    featureIdentified: true,
    helpfulForDecision: true,
    comments: 'Clear severity badges (Green/Amber/Red) and the REVIEW RECOMMENDED callout make it easy to explain to non-technical ops staff why model behavior needs inspection.',
    timestamp: '2026-09-08 09:15',
    isSynthetic: true
  },
  {
    id: 'syn_3',
    role: 'Model Governance Manager',
    problemClear: true,
    alertUnderstandable: true,
    featureIdentified: true,
    helpfulForDecision: true,
    comments: 'The baseline persistence and configurable statistical thresholds provide the exact audit trail needed for enterprise model compliance reviews.',
    timestamp: '2026-09-08 11:45',
    isSynthetic: true
  }
];

export const StakeholderValidation: React.FC = () => {
  const [feedbackList, setFeedbackList] = useState<StakeholderFeedback[]>(INITIAL_FEEDBACK);
  const [role, setRole] = useState('Senior Data Scientist');
  const [problemClear, setProblemClear] = useState(true);
  const [alertUnderstandable, setAlertUnderstandable] = useState(true);
  const [featureIdentified, setFeatureIdentified] = useState(true);
  const [helpfulForDecision, setHelpfulForDecision] = useState(true);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: StakeholderFeedback = {
      id: `user_${Date.now()}`,
      role,
      problemClear,
      alertUnderstandable,
      featureIdentified,
      helpfulForDecision,
      comments: comments.trim() || 'Evaluated ModelWatch prototype during interactive testing.',
      timestamp: new Date().toLocaleTimeString() + ' (Today)',
      isSynthetic: false
    };
    setFeedbackList([newEntry, ...feedbackList]);
    setComments('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ background: '#F8FAFC', borderLeft: '4px solid var(--accent-blue)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <MessageSquareText size={22} color="var(--accent-blue)" />
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)' }}>
              Stakeholder Feedback & Prototype Validation
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--navy-600)' }}>
              Gather feedback from ML DS Teams, Fraud Operations, and Model Governance Managers.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Form */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
            Submit Stakeholder Feedback
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.84rem' }}>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Your Enterprise Role:</label>
              <select
                className="model-select"
                style={{ width: '100%', background: 'white', color: 'var(--navy-900)', border: '1px solid var(--border-light)' }}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Senior Data Scientist">Senior Data Scientist / ML Engineer</option>
                <option value="Fraud Operations Manager">Fraud Operations Manager</option>
                <option value="Model Governance Manager">Model Governance Manager</option>
                <option value="Risk & Compliance Officer">Risk & Compliance Officer</option>
                <option value="Head of ML Engineering">Head of ML Engineering</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: 600 }}>Validation Checklist Questions:</label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={problemClear} onChange={(e) => setProblemClear(e.target.checked)} />
                Was the ML drift problem immediately clear?
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={alertUnderstandable} onChange={(e) => setAlertUnderstandable(e.target.checked)} />
                Were the alert triggers understandable?
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={featureIdentified} onChange={(e) => setFeatureIdentified(e.target.checked)} />
                Could you easily identify which feature drifted?
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={helpfulForDecision} onChange={(e) => setHelpfulForDecision(e.target.checked)} />
                Would this help decide when to investigate a model?
              </label>
            </div>

            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Qualitative Feedback & Comments:</label>
              <textarea
                rows={3}
                style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border-light)', padding: '0.5rem', fontFamily: 'inherit', fontSize: '0.84rem' }}
                placeholder="Share thoughts on statistical thresholds, feature breakdown, or workflow..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>

            <button className="btn-demo-quick" type="submit" style={{ justifyContent: 'center' }}>
              <Send size={16} /> Submit Validation Feedback
            </button>

            {submitted && (
              <div className="badge-status badge-green" style={{ justifyContent: 'center', padding: '0.5rem' }}>
                <CheckCircle2 size={15} /> Feedback recorded successfully!
              </div>
            )}
          </form>
        </div>

        {/* Existing Responses List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Stakeholder Reviews</h3>
            <span style={{ fontSize: '0.74rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Info size={13} /> Labeled synthetic responses
            </span>
          </div>

          {feedbackList.map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '0.88rem', color: 'var(--navy-900)' }}>{item.role}</strong>
                {item.isSynthetic ? (
                  <span className="badge-status" style={{ background: '#F1F5F9', color: '#64748B', fontSize: '0.65rem' }}>
                    Example Validation — Synthetic
                  </span>
                ) : (
                  <span className="badge-status badge-green" style={{ fontSize: '0.65rem' }}>
                    Live Response
                  </span>
                )}
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--navy-700)', fontStyle: 'italic' }}>
                "{item.comments}"
              </p>

              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', fontSize: '0.72rem', color: '#047857', fontWeight: 600, marginTop: '0.25rem' }}>
                <span>✓ Problem Clear</span>
                <span>✓ Alert Understandable</span>
                <span>✓ Feature Identified</span>
                <span>✓ Decision Helpful</span>
              </div>

              <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.2rem' }}>
                Submitted: {item.timestamp}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
