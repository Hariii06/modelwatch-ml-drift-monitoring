import React from 'react';
import { DriftMetric, FeatureName } from '../types/monitoring';
import { CheckCircle2, AlertTriangle, ShieldAlert, ChevronRight } from 'lucide-react';

interface FeatureTableProps {
  driftMetrics: DriftMetric[];
  selectedFeature: FeatureName;
  onSelectFeature: (feature: FeatureName) => void;
}

export const FeatureTable: React.FC<FeatureTableProps> = ({
  driftMetrics,
  selectedFeature,
  onSelectFeature
}) => {
  const getStatusBadge = (status: 'GREEN' | 'AMBER' | 'RED') => {
    switch (status) {
      case 'GREEN':
        return <span className="badge-status badge-green"><CheckCircle2 size={11} /> Stable</span>;
      case 'AMBER':
        return <span className="badge-status badge-amber"><AlertTriangle size={11} /> Warning</span>;
      case 'RED':
        return <span className="badge-status badge-red"><ShieldAlert size={11} /> Critical</span>;
    }
  };

  return (
    <div className="table-card">
      <div className="card-header-flex">
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Monitored Features Drift Matrix
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--navy-600)' }}>
            Statistical comparison between 10,000 baseline observations and 5,000 current-period observations. Click a row to visualize distribution shift.
          </p>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Baseline (Mean &plusmn; Std)</th>
              <th>Current (Mean &plusmn; Std)</th>
              <th>Mean Shift %</th>
              <th>PSI Score</th>
              <th>KS p-value</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {driftMetrics.map((metric) => {
              const isSelected = metric.featureName === selectedFeature;
              return (
                <tr
                  key={metric.featureName}
                  className={isSelected ? 'selected' : ''}
                  onClick={() => onSelectFeature(metric.featureName)}
                >
                  <td style={{ fontWeight: 600 }}>
                    {metric.displayName}
                    {metric.currentStats.missingCount > 0 && (
                      <span className="badge-status badge-amber" style={{ fontSize: '0.65rem', marginLeft: '0.5rem' }}>
                        {metric.currentStats.missingPercentage.toFixed(0)}% Missing
                      </span>
                    )}
                  </td>
                  <td className="number-cell">
                    {metric.baselineStats.mean.toFixed(2)} &plusmn; {metric.baselineStats.stdDev.toFixed(2)}
                  </td>
                  <td className="number-cell">
                    {metric.currentStats.mean.toFixed(2)} &plusmn; {metric.currentStats.stdDev.toFixed(2)}
                  </td>
                  <td className="number-cell" style={{ color: Math.abs(metric.meanPercentChange) > 15 ? '#DC2626' : 'inherit' }}>
                    {metric.meanPercentChange > 0 ? '+' : ''}{metric.meanPercentChange.toFixed(1)}%
                  </td>
                  <td className="number-cell" style={{ fontWeight: 700, color: metric.psiScore >= 0.20 ? '#DC2626' : metric.psiScore >= 0.10 ? '#D97706' : '#047857' }}>
                    {metric.psiScore.toFixed(3)}
                  </td>
                  <td className="number-cell">
                    {metric.ksPValue < 0.001 ? '< 0.001' : metric.ksPValue.toFixed(4)}
                  </td>
                  <td>{getStatusBadge(metric.status)}</td>
                  <td>
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.78rem', fontWeight: 600 }}
                    >
                      Chart <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
