import React, { useState, useEffect } from 'react';
import { SystemMetrics } from '../types/api';
import {
  formatBytes,
  formatPercentage,
  getColorByPercentage,
  getCssColorForZone,
} from '../utils/formatting';

interface MetricsGaugesProps {
  metrics: SystemMetrics | null;
  loading: boolean;
  error: string | null;
}

interface GaugeSvgProps {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}

function GaugeSvg({ percentage: initialPercentage, color, size = 120, strokeWidth = 8 }: GaugeSvgProps) {
  const percentage = Math.min(100, Math.max(0, initialPercentage));

  const radius = size / 2 - strokeWidth / 2;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - percentage / 100);

  return (
    <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.5s ease-out',
        }}
      />
    </svg>
  );
}

export function MetricsGauges({ metrics, loading, error }: MetricsGaugesProps) {
  const [displayMetrics, setDisplayMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    if (metrics) {
      setDisplayMetrics(metrics);
    }
  }, [metrics]);

  if (error) {
    return (
      <div className="metrics-gauges metrics-gauges--error">
        <p>Failed to load metrics: {error}</p>
      </div>
    );
  }

  if (loading && !displayMetrics) {
    return (
      <div className="metrics-gauges metrics-gauges--loading">
        <div className="metrics-gauges__skeleton">Loading metrics...</div>
      </div>
    );
  }

  if (!displayMetrics) {
    return (
      <div className="metrics-gauges metrics-gauges--empty">
        <p>No metrics available</p>
      </div>
    );
  }

  const cpuColor = getCssColorForZone(getColorByPercentage(displayMetrics.cpu.percentage));
  const ramColor = getCssColorForZone(getColorByPercentage(displayMetrics.ram.percentage));
  const storageColor = getCssColorForZone(getColorByPercentage(displayMetrics.storage.percentage));

  return (
    <div className="metrics-gauges">
      <div className="metrics-gauges__card">
        <h3 className="metrics-gauges__title">CPU Usage</h3>

        <div className="metrics-gauges__gauge-container">
          <div className="metrics-gauges__gauge">
            <GaugeSvg percentage={displayMetrics.cpu.percentage} color={cpuColor} />
          </div>

          <div className="metrics-gauges__stats">
            <div className="metrics-gauges__stat-value" style={{ color: cpuColor }}>
              {formatPercentage(displayMetrics.cpu.percentage)}
            </div>
            <div className="metrics-gauges__stat-label">Total CPU</div>
          </div>
        </div>
      </div>

      <div className="metrics-gauges__card">
        <h3 className="metrics-gauges__title">RAM Usage</h3>

        <div className="metrics-gauges__gauge-container">
          <div className="metrics-gauges__gauge">
            <GaugeSvg percentage={displayMetrics.ram.percentage} color={ramColor} />
          </div>

          <div className="metrics-gauges__stats">
            <div className="metrics-gauges__stat-value" style={{ color: ramColor }}>
              {formatPercentage(displayMetrics.ram.percentage)}
            </div>
            <div className="metrics-gauges__stat-label">Used</div>
          </div>
        </div>

        <div className="metrics-gauges__breakdown">
          <div className="metrics-gauges__breakdown-item">
            <span className="metrics-gauges__breakdown-label">Total</span>
            <span className="metrics-gauges__breakdown-value">
              {formatBytes(displayMetrics.ram.total)}
            </span>
          </div>
          <div className="metrics-gauges__breakdown-item">
            <span className="metrics-gauges__breakdown-label">Used</span>
            <span className="metrics-gauges__breakdown-value">
              {formatBytes(displayMetrics.ram.used)}
            </span>
          </div>
        </div>
      </div>

      <div className="metrics-gauges__card">
        <h3 className="metrics-gauges__title">Storage</h3>

        <div className="metrics-gauges__gauge-container">
          <div className="metrics-gauges__gauge">
            <GaugeSvg percentage={displayMetrics.storage.percentage} color={storageColor} />
          </div>

          <div className="metrics-gauges__stats">
            <div className="metrics-gauges__stat-value" style={{ color: storageColor }}>
              {formatPercentage(displayMetrics.storage.percentage)}
            </div>
            <div className="metrics-gauges__stat-label">Used</div>
          </div>
        </div>

        <div className="metrics-gauges__breakdown">
          <div className="metrics-gauges__breakdown-item">
            <span className="metrics-gauges__breakdown-label">Total</span>
            <span className="metrics-gauges__breakdown-value">
              {formatBytes(displayMetrics.storage.total)}
            </span>
          </div>
          <div className="metrics-gauges__breakdown-item">
            <span className="metrics-gauges__breakdown-label">Used</span>
            <span className="metrics-gauges__breakdown-value">
              {formatBytes(displayMetrics.storage.used)}
            </span>
          </div>
          <div className="metrics-gauges__breakdown-item">
            <span className="metrics-gauges__breakdown-label">Free</span>
            <span className="metrics-gauges__breakdown-value">
              {formatBytes(displayMetrics.storage.free)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
