import React from 'react';
import { ModelType } from '../types/monitoring';
import { ShieldCheck, Play, HelpCircle, BookOpen, Database } from 'lucide-react';

interface HeaderProps {
  selectedModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  onRunDemo: () => void;
  onOpenGuide: () => void;
  onOpenMethodology: () => void;
  onOpenLegacyAdapter: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedModel,
  onSelectModel,
  onRunDemo,
  onOpenGuide,
  onOpenMethodology,
  onOpenLegacyAdapter
}) => {
  return (
    <header className="header-bar">
      <div className="brand-container">
        <div className="brand-logo">
          <ShieldCheck size={24} />
        </div>
        <div>
          <div className="brand-title">
            ModelWatch
            <span className="env-badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', border: '1px solid rgba(14, 165, 233, 0.4)', background: 'rgba(14, 165, 233, 0.15)' }}>
              ML Drift Monitoring
            </span>
          </div>
          <p className="tagline">Detect model behaviour changes before they become operational problems.</p>
        </div>
      </div>

      <div className="header-controls">
        <div className="env-badge">
          <span className="env-dot"></span>
          Environment: Demo (Synthetic Data)
        </div>

        <select
          className="model-select"
          value={selectedModel}
          onChange={(e) => onSelectModel(e.target.value as ModelType)}
          aria-label="Select Model"
        >
          <option value="fraud_detection">Fraud Detection Model v2.4</option>
          <option value="service_prioritisation">Service Prioritisation Model v1.8</option>
        </select>

        <button className="btn-demo-quick" onClick={onRunDemo} title="Run standard baseline vs drifted demo flow">
          <Play size={16} fill="white" />
          Run Demo
        </button>

        <button
          className="btn-header-ghost"
          onClick={onOpenLegacyAdapter}
          title="Legacy v1 API Coexistence Adapter Demo"
        >
          <Database size={15} /> Legacy API
        </button>

        <button
          className="btn-header-ghost"
          onClick={onOpenGuide}
          title="3-minute Demo Presentation Script"
        >
          <HelpCircle size={15} /> Demo Guide
        </button>

        <button
          className="btn-header-ghost"
          onClick={onOpenMethodology}
          title="Statistical Methodology Details"
        >
          <BookOpen size={15} /> Methodology
        </button>
      </div>
    </header>
  );
};
