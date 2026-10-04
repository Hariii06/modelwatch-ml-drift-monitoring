import React from 'react';
import { LayoutDashboard, FlaskConical, CheckCircle2, MessageSquareText, ShieldCheck } from 'lucide-react';

export type TabType = 'dashboard' | 'ground_truth' | 'experiment' | 'diagnostics' | 'validation';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  failedTestCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab, failedTestCount }) => {
  return (
    <nav className="nav-tabs-bar">
      <button
        className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onSelectTab('dashboard')}
      >
        <LayoutDashboard size={17} /> Drift Monitoring Dashboard
      </button>

      <button
        className={`nav-tab ${activeTab === 'ground_truth' ? 'active' : ''}`}
        onClick={() => onSelectTab('ground_truth')}
      >
        <ShieldCheck size={17} /> Ground Truth & Buffer Engine
      </button>

      <button
        className={`nav-tab ${activeTab === 'experiment' ? 'active' : ''}`}
        onClick={() => onSelectTab('experiment')}
      >
        <FlaskConical size={17} /> Baseline vs Drifted Experiment
      </button>

      <button
        className={`nav-tab ${activeTab === 'diagnostics' ? 'active' : ''}`}
        onClick={() => onSelectTab('diagnostics')}
      >
        <CheckCircle2 size={17} /> Diagnostic Test Suite
        {failedTestCount > 0 ? (
          <span className="badge-status badge-red" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
            {failedTestCount} FAIL
          </span>
        ) : (
          <span className="badge-status badge-green" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
            PASS
          </span>
        )}
      </button>

      <button
        className={`nav-tab ${activeTab === 'validation' ? 'active' : ''}`}
        onClick={() => onSelectTab('validation')}
      >
        <MessageSquareText size={17} /> Stakeholder Validation
      </button>
    </nav>
  );
};
