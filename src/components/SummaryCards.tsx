import React from 'react';
import { MonitoringResult } from '../types/monitoring';
import { Activity, AlertTriangle, CheckCircle, ShieldAlert, BarChart2, Bell } from 'lucide-react';

interface SummaryCardsProps {
  result: MonitoringResult;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ result }) => {
  const getStatusBadge = (status: 'GREEN' | 'AMBER' | 'RED') => {
    switch (status) {
      case 'GREEN':
        return (
          <span className="badge-status badge-green" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}>
            <CheckCircle size={14} /> STABLE — HEALTHY
          </span>
        );
      case 'AMBER':
        return (
          <span className="badge-status badge-amber" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}>
            <AlertTriangle size={14} /> WARNING — MODERATE DRIFT
          </span>
        );
      case 'RED':
        return (
          <span className="badge-status badge-red" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}>
            <ShieldAlert size={14} /> REVIEW RECOMMENDED
          </span>
        );
    }
  };

  const statusBg = result.overallStatus === 'RED' ? '#FEF2F2' : result.overallStatus === 'AMBER' ? '#FFFBEB' : '#F0FDF4';
  const statusBorder = result.overallStatus === 'RED' ? '#FCA5A5' : result.overallStatus === 'AMBER' ? '#FDE68A' : '#86EFAC';

  return (
    <div className="cards-grid">
      {/* Focal Overall Status Card */}
      <div
        className="card"
        style={{
          background: statusBg,
          borderColor: statusBorder,
          boxShadow: 'var(--shadow-md)',
          gridColumn: 'span 1'
        }}
      >
        <div className="card-title" style={{ color: result.overallStatus === 'RED' ? '#991B1B' : result.overallStatus === 'AMBER' ? '#92400E' : '#166534' }}>
          Monitoring Health Status
          <div className="card-icon-wrapper" style={{ background: 'white' }}>
            <Activity size={17} color={result.overallStatus === 'RED' ? '#EF4444' : result.overallStatus === 'AMBER' ? '#F59E0B' : '#10B981'} />
          </div>
        </div>
        <div style={{ marginTop: '0.35rem', marginBottom: '0.35rem' }}>{getStatusBadge(result.overallStatus)}</div>
        <div className="card-subtext" style={{ color: result.overallStatus === 'RED' ? '#B91C1C' : result.overallStatus === 'AMBER' ? '#B45309' : '#15803D' }}>
          Run: {result.lastMonitoringRun} ({result.executionTimeMs}ms)
        </div>
      </div>

      {/* Features Monitored */}
      <div className="card">
        <div className="card-title">
          Features Monitored
          <div className="card-icon-wrapper">
            <BarChart2 size={16} color="var(--navy-600)" />
          </div>
        </div>
        <div className="card-value">{result.featuresMonitored}</div>
        <div className="card-subtext">
          Baseline: {result.baselineCount.toLocaleString()} | Current: {result.currentCount.toLocaleString()}
        </div>
      </div>

      {/* Features With Drift */}
      <div className="card">
        <div className="card-title">
          Features With Drift
          <div className="card-icon-wrapper" style={{ background: result.featuresWithDrift > 0 ? '#FEF2F2' : '#F0FDF4' }}>
            <AlertTriangle size={16} color={result.featuresWithDrift > 0 ? '#EF4444' : '#10B981'} />
          </div>
        </div>
        <div className="card-value" style={{ color: result.featuresWithDrift > 0 ? '#EF4444' : '#10B981' }}>
          {result.featuresWithDrift}
        </div>
        <div className="card-subtext">
          {result.featuresWithWarning} with warning | PSI Threshold &ge; {result.thresholds.psiCritical}
        </div>
      </div>

      {/* Prediction Drift */}
      <div className="card">
        <div className="card-title">
          Prediction Drift
          <div className="card-icon-wrapper">
            <Activity size={16} color={result.predictionMetrics.status === 'RED' ? '#EF4444' : '#10B981'} />
          </div>
        </div>
        <div style={{ marginTop: '0.35rem', marginBottom: '0.35rem' }}>
          {getStatusBadge(result.predictionMetrics.status)}
        </div>
        <div className="card-subtext">
          Pos Rate: {result.predictionMetrics.baselinePositiveRate.toFixed(1)}% &rarr; {result.predictionMetrics.currentPositiveRate.toFixed(1)}% ({result.predictionMetrics.rateChangePercent > 0 ? '+' : ''}{result.predictionMetrics.rateChangePercent.toFixed(1)}%)
        </div>
      </div>

      {/* Review Alerts */}
      <div className="card">
        <div className="card-title">
          Review Alerts
          <div className="card-icon-wrapper" style={{ background: result.alerts.length > 0 ? '#FEF2F2' : '#F8FAFC' }}>
            <Bell size={16} color={result.alerts.length > 0 ? '#EF4444' : 'var(--navy-500)'} />
          </div>
        </div>
        <div className="card-value" style={{ color: result.alerts.length > 0 ? '#EF4444' : 'inherit' }}>
          {result.alerts.length}
        </div>
        <div className="card-subtext">
          {result.alerts.length > 0 ? 'Actionable review triggers generated' : 'No triggers exceeded'}
        </div>
      </div>
    </div>
  );
};
