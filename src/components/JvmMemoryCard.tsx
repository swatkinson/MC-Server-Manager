import { useState } from 'react';
import type { JvmMemory, JvmPressure, SystemMetrics } from '../types/api';
import { useJvmHistory } from '../hooks/useJvmHistory';
import { formatBytes, formatUptime } from '../utils/formatting';
import { MemoryChart, SERIES } from './MemoryChart';

const WINDOWS = [
  { label: '15m', ms: 15 * 60_000 },
  { label: '1h', ms: 60 * 60_000 },
];

const PRESSURE_LABEL: Record<JvmPressure, string> = {
  ok: 'Healthy',
  elevated: 'Under pressure',
  critical: 'Throttling',
};

const PRESSURE_GLYPH: Record<JvmPressure, string> = { ok: '✓', elevated: '!', critical: '✕' };

export function JvmMemoryCard({ metrics }: { metrics: SystemMetrics | null }) {
  const [windowMs, setWindowMs] = useState(WINDOWS[0].ms);
  const samples = useJvmHistory(metrics);
  const jvm = metrics?.ram.jvm ?? null;

  return (
    <section className="card glass memory-card">
      <header className="card__header">
        <div>
          <h2 className="card__title">Minecraft memory</h2>
          <p className="card__subtitle">Measured inside the JVM — what the game is actually holding, not what Java reserved.</p>
        </div>
        <div className="card__header-actions">
          {jvm && (
            <span className={`pressure-badge pressure-badge--${jvm.pressure}`} title={jvm.pressureReason}>
              <span aria-hidden="true">{PRESSURE_GLYPH[jvm.pressure]}</span> {PRESSURE_LABEL[jvm.pressure]}
            </span>
          )}
          <div className="segmented" role="group" aria-label="Time range">
            {WINDOWS.map((w) => (
              <button
                key={w.label}
                className={`segmented__btn ${windowMs === w.ms ? 'segmented__btn--active' : ''}`}
                onClick={() => setWindowMs(w.ms)}
                aria-pressed={windowMs === w.ms}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {!jvm ? (
        <div className="empty-state">The server isn't running — memory insight appears once the JVM starts.</div>
      ) : (
        <>
          <div className="legend">
            {SERIES.map((s) => (
              <span key={s.key} className="legend__item">
                <span className="legend__line" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
            <span className="legend__item">
              <span className="legend__line legend__line--dashed" />
              Max heap (-Xmx)
            </span>
          </div>

          <MemoryChart samples={samples} heapMax={jvm.heapMax} windowMs={windowMs} />

          <p className={`memory-card__verdict memory-card__verdict--${jvm.pressure}`}>{jvm.pressureReason}</p>

          <JvmStats jvm={jvm} />

          <details className="memory-card__explain">
            <summary>How to read this</summary>
            <p>
              <strong>Live data</strong> is what survived the last garbage collection — the memory Minecraft genuinely
              holds (loaded chunks, entities, mod data). <strong>In heap</strong> also counts short-lived garbage the next
              collection will discard, so it sawtooths constantly; that's normal.
            </p>
            <p>
              <strong>Reserved by Java</strong> is the process footprint the OS sees. With -Xms equal to -Xmx and
              AlwaysPreTouch, Java claims the whole heap at boot and never gives it back, which is why system RAM looks
              permanently full. The server is only starved when live data approaches the max heap and GC pauses climb —
              that's when ticks get delayed.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

function JvmStats({ jvm }: { jvm: JvmMemory }) {
  const livePct = jvm.heapMax ? (jvm.heapLive / jvm.heapMax) * 100 : null;
  const precise = jvm.source === 'hsperfdata';

  return (
    <div className="stat-grid">
      <div className="stat">
        <span className="stat__label">Live data</span>
        <span className="stat__value">{precise ? formatBytes(jvm.heapLive, 1) : '—'}</span>
        {livePct !== null && precise && (
          <>
            <div className="meter" aria-hidden="true">
              <div className={`meter__fill meter__fill--${jvm.pressure}`} style={{ width: `${Math.min(100, livePct)}%` }} />
            </div>
            <span className="stat__hint">{livePct.toFixed(0)}% of {formatBytes(jvm.heapMax ?? 0, 0)} max heap</span>
          </>
        )}
      </div>
      <div className="stat">
        <span className="stat__label">In heap now</span>
        <span className="stat__value">{precise ? formatBytes(jvm.heapUsed, 1) : '—'}</span>
        <span className="stat__hint">{precise ? `${formatBytes(jvm.heapCommitted, 1)} committed` : 'perf counters unavailable'}</span>
      </div>
      <div className="stat">
        <span className="stat__label">Reserved by Java</span>
        <span className="stat__value">{jvm.rss !== null ? formatBytes(jvm.rss, 1) : '—'}</span>
        <span className="stat__hint">{precise ? `incl. ${formatBytes(jvm.metaspaceUsed, 0)} class metadata` : 'process RSS'}</span>
      </div>
      <div className="stat">
        <span className="stat__label">GC pause time</span>
        <span className="stat__value">{jvm.gcPausePercent !== null ? `${jvm.gcPausePercent.toFixed(2)}%` : '—'}</span>
        <span className="stat__hint">
          {jvm.youngGcPerMin !== null ? `${jvm.youngGcPerMin.toFixed(1)} collections/min` : 'last 60 s'}
        </span>
      </div>
      <div className="stat">
        <span className="stat__label">Full GCs</span>
        <span className="stat__value">{precise ? jvm.fullGcCount : '—'}</span>
        <span className="stat__hint">
          {jvm.lastFullGcAgoSec !== null ? `last ${formatUptime(jvm.lastFullGcAgoSec)} ago` : 'none since start — good'}
        </span>
      </div>
    </div>
  );
}
