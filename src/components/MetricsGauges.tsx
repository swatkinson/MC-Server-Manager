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

const HEAP_COLOR = '#22c55e'; // var(--green)
const OTHER_COLOR = '#64748b'; // muted slate

interface RamCardProps {
  ram: SystemMetrics['ram'];
  fallbackColor: string;
}

function RamCard({ ram, fallbackColor }: RamCardProps) {
  const total = ram.total;
  const heapUsed = ram.jvm?.heapUsed ?? 0;
  const heapMax = ram.jvm?.heapMax ?? 0;
  const otherUsed = ram.systemOther;
  const heapPct = total > 0 ? clampPct((heapUsed / total) * 100) : 0;
  const otherPct = total > 0 ? clampPct((otherUsed / total) * 100) : 0;
  const xmxPct = total > 0 && heapMax > 0 ? clampPct((heapMax / total) * 100) : null;
  const heapVsXmx = heapMax > 0 ? clampPct((heapUsed / heapMax) * 100) : null;

  return (
    <div className="metrics-gauges__card">
      <h3 className="metrics-gauges__title">RAM Usage</h3>

      <div className="ram-meter">
        <div className="ram-meter__bar">
          <div
            className="ram-meter__segment ram-meter__segment--heap"
            style={{ width: `${heapPct}%`, background: HEAP_COLOR }}
            title={`JVM heap: ${formatBytes(heapUsed)}`}
          />
          <div
            className="ram-meter__segment ram-meter__segment--other"
            style={{ width: `${otherPct}%`, background: OTHER_COLOR }}
            title={`Other system usage: ${formatBytes(otherUsed)}`}
          />
          {xmxPct !== null && (
            <div
              className="ram-meter__xmx"
              style={{ left: `${xmxPct}%` }}
              title={`-Xmx ceiling: ${formatBytes(heapMax)}`}
            >
              <span className="ram-meter__xmx-label">Xmx</span>
            </div>
          )}
        </div>
        <div className="ram-meter__scale">
          <span>0</span>
          <span>{formatBytes(total)}</span>
        </div>
      </div>

      <div className="metrics-gauges__breakdown">
        <div className="metrics-gauges__breakdown-item">
          <span className="metrics-gauges__breakdown-color" style={{ background: HEAP_COLOR }} />
          <span className="metrics-gauges__breakdown-label">JVM heap</span>
          <span
            className="metrics-gauges__breakdown-value"
            style={{ color: ram.jvm ? undefined : fallbackColor }}
          >
            {ram.jvm
              ? `${formatBytes(heapUsed)} / ${formatBytes(heapMax)}${
                  heapVsXmx !== null ? ` (${heapVsXmx.toFixed(0)}%)` : ''
                }`
              : 'unavailable'}
          </span>
        </div>
        <div className="metrics-gauges__breakdown-item">
          <span className="metrics-gauges__breakdown-color" style={{ background: OTHER_COLOR }} />
          <span className="metrics-gauges__breakdown-label">Other system</span>
          <span className="metrics-gauges__breakdown-value">{formatBytes(otherUsed)}</span>
        </div>
        <div className="metrics-gauges__breakdown-item">
          <span className="metrics-gauges__breakdown-label">Total RAM</span>
          <span className="metrics-gauges__breakdown-value">{formatBytes(total)}</span>
        </div>
      </div>
    </div>
  );
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
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

      <RamCard ram={displayMetrics.ram} fallbackColor={ramColor} />

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
