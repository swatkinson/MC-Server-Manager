import type { SystemMetrics } from '../types/api';
import { formatBytes } from '../utils/formatting';

function barTone(pct: number): string {
  return pct >= 90 ? 'bad' : pct >= 75 ? 'warn' : 'ok';
}

export function SystemCard({ metrics }: { metrics: SystemMetrics | null }) {
  if (!metrics) {
    return (
      <section className="card glass">
        <h2 className="card__title">System</h2>
        <div className="empty-state">Loading metrics…</div>
      </section>
    );
  }

  const { ram, cpu } = metrics;
  const javaBytes = ram.jvm?.rss ?? 0;
  const pct = (b: number) => (ram.total > 0 ? (b / ram.total) * 100 : 0);

  return (
    <section className="card glass system-card">
      <h2 className="card__title">System</h2>

      <div className="system-card__block">
        <div className="system-card__row">
          <span>VM memory</span>
          <span className="system-card__value">
            {formatBytes(ram.used, 1)} / {formatBytes(ram.total, 0)}
          </span>
        </div>
        <div className="stacked-bar" role="img" aria-label="VM memory split between Java, other processes and free">
          <div className="stacked-bar__seg stacked-bar__seg--java" style={{ width: `${pct(javaBytes)}%` }} />
          <div className="stacked-bar__seg stacked-bar__seg--other" style={{ width: `${pct(ram.systemOther)}%` }} />
        </div>
        <div className="legend legend--compact">
          <span className="legend__item">
            <span className="legend__swatch legend__swatch--java" />
            Java {formatBytes(javaBytes, 1)}
          </span>
          <span className="legend__item">
            <span className="legend__swatch legend__swatch--other" />
            Other {formatBytes(ram.systemOther, 1)}
          </span>
          <span className="legend__item">
            <span className="legend__swatch legend__swatch--free" />
            Free {formatBytes(Math.max(0, ram.total - ram.used), 1)}
          </span>
        </div>
      </div>

      <div className="system-card__block">
        <div className="system-card__row">
          <span>CPU</span>
          <span className="system-card__value">{cpu.percentage.toFixed(0)}% avg</span>
        </div>
        <div className="core-bars">
          {cpu.cores.map((c, i) => (
            <div key={i} className="core-bars__item" title={`Core ${i}: ${c.toFixed(0)}%`}>
              <div className="core-bars__track">
                <div className={`core-bars__fill core-bars__fill--${barTone(c)}`} style={{ height: `${Math.max(2, c)}%` }} />
              </div>
              <span className="core-bars__label">{i}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="system-card__block">
        <div className="system-card__row">
          <span>Disk</span>
          <span className="system-card__value">
            {formatBytes(metrics.storage.used, 0)} / {formatBytes(metrics.storage.total, 0)}
          </span>
        </div>
        <div className="meter">
          <div className={`meter__fill meter__fill--${barTone(metrics.storage.percentage) === 'ok' ? 'ok' : 'elevated'}`} style={{ width: `${metrics.storage.percentage}%` }} />
        </div>
      </div>
    </section>
  );
}
