import React, { useState, useEffect } from 'react';
import { SystemMetrics } from '../types/api';
import {
  formatBytes,
  formatPercentage,
  getColorByPercentage,
  getCpuColorByPercentage,
  getCssColorForZone,
} from '../utils/formatting';

interface MetricsGaugesProps {
  metrics: SystemMetrics | null;
  loading: boolean;
  error: string | null;
}

/**
 * Semi-circle gauge SVG component
 * Renders a 180-degree gauge with a filled arc
 */
interface GaugeSvgProps {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}

function GaugeSvg({ percentage: initialPercentage, color, size = 120, strokeWidth = 8 }: GaugeSvgProps) {
  // Clamp percentage between 0 and 100
  const percentage = Math.min(100, Math.max(0, initialPercentage));

  const radius = size / 2 - strokeWidth / 2;
  const circumference = Math.PI * radius; // Semi-circle circumference
  const offset = circumference * (1 - percentage / 100);

  return (
    <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
      {/* Background arc */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Filled arc */}
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

/**
 * Dual-color gauge for CPU usage
 * Shows JVM and other processes side by side
 */
interface CpuGaugeSvgProps {
  jvmPercentage: number;
  otherPercentage: number;
  size?: number;
  strokeWidth?: number;
}

function CpuGaugeSvg({ jvmPercentage, otherPercentage, size = 120, strokeWidth = 8 }: CpuGaugeSvgProps) {
  const jvm = Math.min(100, Math.max(0, jvmPercentage));
  const other = Math.min(100, Math.max(0, otherPercentage));

  const radius = size / 2 - strokeWidth / 2;
  const circumference = Math.PI * radius;

  // JVM offset (first half)
  const jvmOffset = circumference * 0.5 * (1 - jvm / 100);
  // Other offset (second half)
  const otherOffset = circumference * 0.5 * (1 - other / 100);

  return (
    <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
      {/* Background arc */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* JVM arc (left half) */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size / 2} ${strokeWidth / 2}`}
        fill="none"
        stroke="var(--blue)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference * 0.5}
        strokeDashoffset={jvmOffset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.5s ease-out',
        }}
      />

      {/* Other processes arc (right half) */}
      <path
        d={`M ${size / 2} ${strokeWidth / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke="var(--yellow)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference * 0.5}
        strokeDashoffset={otherOffset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.5s ease-out',
        }}
      />
    </svg>
  );
}

/**
 * RAM gauge with allocation marker
 * Shows total RAM, JVM allocation (marker), and current JVM usage (fill)
 */
interface RamGaugeSvgProps {
  totalRam: number;
  jvmAllocated: number;
  jvmUsed: number;
  size?: number;
  strokeWidth?: number;
}

function RamGaugeSvg({ totalRam, jvmAllocated, jvmUsed, size = 120, strokeWidth = 8 }: RamGaugeSvgProps) {
  const usedPercentage = totalRam > 0 ? (jvmUsed / totalRam) * 100 : 0;
  const allocatedPercentage = totalRam > 0 ? (jvmAllocated / totalRam) * 100 : 0;

  const radius = size / 2 - strokeWidth / 2;
  const circumference = Math.PI * radius;

  // Filled offset (used RAM)
  const filledOffset = circumference * (1 - usedPercentage / 100);

  // Calculate angle for allocation marker (in degrees, 0-180)
  const allocationAngle = (allocatedPercentage / 100) * 180;
  // Convert angle to SVG path coordinates
  const allocMarkerAngle = (allocationAngle * Math.PI) / 180;
  const allocMarkerX = size / 2 + radius * Math.cos(Math.PI - allocMarkerAngle);
  const allocMarkerY = size / 2 + radius * Math.sin(Math.PI - allocMarkerAngle);

  return (
    <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
      {/* Background arc */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Filled arc (JVM used) */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke="var(--blue)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={filledOffset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.5s ease-out',
        }}
      />

      {/* Allocation marker */}
      <circle
        cx={allocMarkerX}
        cy={allocMarkerY}
        r={strokeWidth / 1.5}
        fill="var(--purple)"
        opacity="0.8"
      />
    </svg>
  );
}

export function MetricsGauges({ metrics, loading, error }: MetricsGaugesProps) {
  const [displayMetrics, setDisplayMetrics] = useState<SystemMetrics | null>(null);

  // Smooth animation by deferring metric updates
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

  const cpuColor = getCssColorForZone(getCpuColorByPercentage(displayMetrics.cpu.percentage));
  const ramColor = getCssColorForZone(getColorByPercentage(displayMetrics.ram.percentage));
  const storageColor = getCssColorForZone(getColorByPercentage(displayMetrics.storage.percentage));

  return (
    <div className="metrics-gauges">
      {/* CPU Gauge */}
      <div className="metrics-gauges__card">
        <h3 className="metrics-gauges__title">CPU Usage</h3>

        <div className="metrics-gauges__gauge-container">
          <div className="metrics-gauges__gauge">
            <CpuGaugeSvg
              jvmPercentage={displayMetrics.cpu.jvmPercentage}
              otherPercentage={displayMetrics.cpu.otherPercentage}
            />
          </div>

          <div className="metrics-gauges__stats">
            <div className="metrics-gauges__stat-value" style={{ color: cpuColor }}>
              {formatPercentage(displayMetrics.cpu.percentage)}
            </div>
            <div className="metrics-gauges__stat-label">Total CPU</div>
          </div>
        </div>

        <div className="metrics-gauges__breakdown">
          <div className="metrics-gauges__breakdown-item">
            <span
              className="metrics-gauges__breakdown-color"
              style={{ backgroundColor: 'var(--blue)' }}
            />
            <span className="metrics-gauges__breakdown-label">JVM</span>
            <span className="metrics-gauges__breakdown-value">
              {formatPercentage(displayMetrics.cpu.jvmPercentage)}
            </span>
          </div>
          <div className="metrics-gauges__breakdown-item">
            <span
              className="metrics-gauges__breakdown-color"
              style={{ backgroundColor: 'var(--yellow)' }}
            />
            <span className="metrics-gauges__breakdown-label">Other</span>
            <span className="metrics-gauges__breakdown-value">
              {formatPercentage(displayMetrics.cpu.otherPercentage)}
            </span>
          </div>
        </div>
      </div>

      {/* RAM Gauge */}
      <div className="metrics-gauges__card">
        <h3 className="metrics-gauges__title">RAM Usage</h3>

        <div className="metrics-gauges__gauge-container">
          <div className="metrics-gauges__gauge">
            <RamGaugeSvg
              totalRam={displayMetrics.ram.total}
              jvmAllocated={displayMetrics.ram.jvmAllocated}
              jvmUsed={displayMetrics.ram.jvmUsed}
            />
          </div>

          <div className="metrics-gauges__stats">
            <div className="metrics-gauges__stat-value" style={{ color: ramColor }}>
              {formatPercentage(displayMetrics.ram.percentage)}
            </div>
            <div className="metrics-gauges__stat-label">JVM Usage</div>
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
            <span className="metrics-gauges__breakdown-label">Allocated</span>
            <span className="metrics-gauges__breakdown-value">
              {formatBytes(displayMetrics.ram.jvmAllocated)}
            </span>
          </div>
          <div className="metrics-gauges__breakdown-item">
            <span className="metrics-gauges__breakdown-label">Used</span>
            <span className="metrics-gauges__breakdown-value">
              {formatBytes(displayMetrics.ram.jvmUsed)}
            </span>
          </div>
        </div>
      </div>

      {/* Storage Gauge */}
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
