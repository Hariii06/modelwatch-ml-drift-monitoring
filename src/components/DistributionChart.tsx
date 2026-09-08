import React from 'react';
import { DriftMetric } from '../types/monitoring';
import { BarChart3, Info } from 'lucide-react';

interface DistributionChartProps {
  metric: DriftMetric;
}

export const DistributionChart: React.FC<DistributionChartProps> = ({ metric }) => {
  const maxRatio = Math.max(
    ...metric.bins.flatMap(b => [b.baselineRatio, b.currentRatio]),
    0.05
  );

  const svgWidth = 560;
  const svgHeight = 220;
  const paddingLeft = 45;
  const paddingBottom = 35;
  const paddingTop = 15;
  const paddingRight = 15;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const numBins = metric.bins.length;
  const groupWidth = chartWidth / numBins;
  const barWidth = Math.max(2, (groupWidth - 8) / 2);

  const isDrifted = metric.status === 'RED';

  return (
    <div className="chart-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BarChart3 size={18} color="var(--accent-blue)" />
            Distribution Comparison: {metric.displayName}
          </h3>
          <p style={{ fontSize: '0.76rem', color: 'var(--navy-600)' }}>
            Baseline Population vs Current Monitoring Window (PSI: {metric.psiScore.toFixed(3)})
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 12, height: 12, backgroundColor: '#0F172A', borderRadius: 2, display: 'inline-block' }}></span>
            Baseline (10k)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 12, height: 12, backgroundColor: isDrifted ? '#EF4444' : '#0EA5E9', borderRadius: 2, display: 'inline-block' }}></span>
            Current (5k)
          </div>
        </div>
      </div>

      <div className="chart-svg-wrapper">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%' }}>
          {/* Grid lines & Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((fraction, idx) => {
            const yVal = maxRatio * (1 - fraction);
            const yPos = paddingTop + fraction * chartHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={svgWidth - paddingRight}
                  y2={yPos}
                  stroke="#E2E8F0"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 8}
                  y={yPos + 4}
                  fontSize="10"
                  fill="#64748B"
                  textAnchor="end"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {(yVal * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* Histogram Bars */}
          {metric.bins.map((bin, i) => {
            const groupX = paddingLeft + i * groupWidth + 4;

            const bHeight = (bin.baselineRatio / maxRatio) * chartHeight;
            const bY = paddingTop + chartHeight - bHeight;

            const cHeight = (bin.currentRatio / maxRatio) * chartHeight;
            const cY = paddingTop + chartHeight - cHeight;

            return (
              <g key={i}>
                {/* Baseline Bar */}
                <rect
                  x={groupX}
                  y={bY}
                  width={barWidth}
                  height={Math.max(1, bHeight)}
                  fill="#0F172A"
                  rx={2}
                  opacity={0.9}
                >
                  <title>{`Baseline Bin ${i+1}: ${(bin.baselineRatio * 100).toFixed(1)}% (${bin.baselineCount} samples)`}</title>
                </rect>

                {/* Current Bar */}
                <rect
                  x={groupX + barWidth + 2}
                  y={cY}
                  width={barWidth}
                  height={Math.max(1, cHeight)}
                  fill={isDrifted ? '#EF4444' : '#0EA5E9'}
                  rx={2}
                  opacity={0.85}
                >
                  <title>{`Current Bin ${i+1}: ${(bin.currentRatio * 100).toFixed(1)}% (${bin.currentCount} samples)`}</title>
                </rect>

                {/* X Axis Bin Label */}
                <text
                  x={groupX + barWidth}
                  y={svgHeight - 10}
                  fontSize="9"
                  fill="#64748B"
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                >
                  B{i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ marginTop: '0.85rem', background: '#F8FAFC', padding: '0.65rem 0.85rem', borderRadius: 6, fontSize: '0.78rem', color: 'var(--navy-700)', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #E2E8F0' }}>
        <Info size={15} color="var(--accent-blue)" />
        <span>
          <strong>PSI Bin Breakdown:</strong> Max PSI contribution bin: B
          {metric.bins.reduce((maxIdx, bin, idx, arr) => (bin.psiContribution > arr[maxIdx].psiContribution ? idx : maxIdx), 0) + 1} (
          {metric.bins.reduce((max, b) => Math.max(max, b.psiContribution), 0).toFixed(4)} PSI weight).
        </span>
      </div>
    </div>
  );
};
