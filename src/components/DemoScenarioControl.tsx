import React from 'react';
import { ScenarioType, ThresholdConfig } from '../types/monitoring';
import { Sliders, Zap, CheckCircle2, AlertOctagon, HelpCircle, AlertTriangle } from 'lucide-react';

interface DemoScenarioControlProps {
  currentScenario: ScenarioType;
  onSelectScenario: (scenario: ScenarioType) => void;
  thresholds: ThresholdConfig;
  onUpdateThresholds: (thresholds: ThresholdConfig) => void;
}

export const DemoScenarioControl: React.FC<DemoScenarioControlProps> = ({
  currentScenario,
  onSelectScenario,
  thresholds,
  onUpdateThresholds
}) => {
  return (
    <div className="controls-panel">
      <div className="controls-header">
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={18} color="var(--accent-blue)" />
            Demo Scenario & Statistical Threshold Control
          </h3>
          <p style={{ fontSize: '0.76rem', color: 'var(--navy-600)' }}>
            Switch live synthetic data scenarios or adjust statistical drift sensitivity thresholds to instantly recalculate alerts.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-700)', textTransform: 'uppercase' }}>
          Select Monitoring Dataset Scenario:
        </div>
        <div className="scenario-buttons">
          <button
            className={`btn-scenario ${currentScenario === 'stable' ? 'active' : ''}`}
            onClick={() => onSelectScenario('stable')}
          >
            <CheckCircle2 size={15} color={currentScenario === 'stable' ? 'white' : '#10B981'} />
            Scenario A: Stable Baseline
          </button>

          <button
            className={`btn-scenario ${currentScenario === 'drifted' ? 'active' : ''}`}
            onClick={() => onSelectScenario('drifted')}
          >
            <AlertOctagon size={15} color={currentScenario === 'drifted' ? 'white' : '#EF4444'} />
            Scenario B: Drifted Features
          </button>

          <button
            className={`btn-scenario ${currentScenario === 'missing_data' ? 'active' : ''}`}
            onClick={() => onSelectScenario('missing_data')}
          >
            <HelpCircle size={15} color={currentScenario === 'missing_data' ? 'white' : '#F59E0B'} />
            Test Case 1: Missing Data (18%)
          </button>

          <button
            className={`btn-scenario ${currentScenario === 'noisy_data' ? 'active' : ''}`}
            onClick={() => onSelectScenario('noisy_data')}
          >
            <AlertTriangle size={15} color={currentScenario === 'noisy_data' ? 'white' : '#D97706'} />
            Test Case 2: Extreme Outliers
          </button>
        </div>
      </div>

      <div className="threshold-sliders">
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-900)' }}>
          <Sliders size={15} color="var(--accent-blue)" />
          Configurable Statistical Thresholds (Live Recalculation)
        </div>

        <div className="slider-group">
          <div className="slider-label">
            <span>PSI Warning Threshold</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>{thresholds.psiWarning.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.02"
            max="0.30"
            step="0.01"
            className="slider-input"
            value={thresholds.psiWarning}
            onChange={(e) => onUpdateThresholds({ ...thresholds, psiWarning: parseFloat(e.target.value) })}
          />
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Default: 0.10 (Moderate shift indicator)</span>
        </div>

        <div className="slider-group">
          <div className="slider-label">
            <span>PSI Critical Threshold</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#DC2626' }}>{thresholds.psiCritical.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.50"
            step="0.01"
            className="slider-input"
            value={thresholds.psiCritical}
            onChange={(e) => onUpdateThresholds({ ...thresholds, psiCritical: parseFloat(e.target.value) })}
          />
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Default: 0.20 (Review recommended trigger)</span>
        </div>

        <div className="slider-group">
          <div className="slider-label">
            <span>KS Test p-Value Alpha</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--navy-900)' }}>{thresholds.ksPValueThreshold.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min="0.001"
            max="0.20"
            step="0.005"
            className="slider-input"
            value={thresholds.ksPValueThreshold}
            onChange={(e) => onUpdateThresholds({ ...thresholds, ksPValueThreshold: parseFloat(e.target.value) })}
          />
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Default: 0.05 (Statistical significance limit)</span>
        </div>
      </div>
    </div>
  );
};
