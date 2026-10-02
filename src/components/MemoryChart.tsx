import { useEffect, useMemo, useRef, useState } from 'react';
import type { JvmSample } from '../types/api';
import { formatBytes } from '../utils/formatting';

interface MemoryChartProps {
  samples: JvmSample[];
  heapMax: number | null;
  windowMs: number;
}

const HEIGHT = 220;
const PAD = { top: 14, right: 12, bottom: 24, left: 52 };

// Validated pair (dataviz validator, dark surface): heap-in-use orange, live teal.
export const SERIES = [
  { key: 'heapUsed', label: 'In heap (incl. garbage)', color: 'var(--chart-heap)' },
  { key: 'heapLive', label: 'Live data', color: 'var(--chart-live)' },
] as const;

function niceStep(max: number): number {
  const gb = 1024 ** 3;
  const candidates = [0.25, 0.5, 1, 2, 4, 8, 16].map((g) => g * gb);
  return candidates.find((c) => max / c <= 5) ?? 32 * gb;
}

export function MemoryChart({ samples, heapMax, windowMs }: MemoryChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const now = samples.length ? samples[samples.length - 1].t : Date.now();
  const visible = useMemo(() => samples.filter((s) => s.t >= now - windowMs), [samples, now, windowMs]);

  const yMaxRaw = Math.max(heapMax ?? 0, ...visible.map((s) => s.heapUsed), 1);
  const step = niceStep(yMaxRaw);
  const yMax = Math.ceil(yMaxRaw / step) * step;
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - (now - windowMs)) / windowMs) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  const path = (key: 'heapUsed' | 'heapLive') =>
    visible.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s[key]).toFixed(1)}`).join('');

  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += step) ticks.push(v);
  const timeTicks = [1, 0.75, 0.5, 0.25, 0].map((f) => now - windowMs * f);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    if (!visible.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + PAD.left;
    let best = 0;
    for (let i = 1; i < visible.length; i++) {
      if (Math.abs(x(visible[i].t) - px) < Math.abs(x(visible[best].t) - px)) best = i;
    }
    setHover(best);
  }

  const hovered = hover !== null ? visible[hover] : null;

  return (
    <div className="memory-chart" ref={wrapRef}>
      {visible.length < 2 ? (
        <div className="memory-chart__empty">Collecting samples… the graph fills in every 5 seconds.</div>
      ) : (
        <svg width={width} height={HEIGHT} role="img" aria-label="Minecraft JVM heap usage over time">
          {ticks.map((v) => (
            <g key={v}>
              <line className="memory-chart__grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="memory-chart__axis" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">
                {formatBytes(v, v % (1024 ** 3) === 0 ? 0 : 1)}
              </text>
            </g>
          ))}
          {timeTicks.map((t, i) => (
            <text
              key={i}
              className="memory-chart__axis"
              x={x(t)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? 'start' : i === timeTicks.length - 1 ? 'end' : 'middle'}
            >
              {i === timeTicks.length - 1 ? 'now' : `-${Math.round((now - t) / 60_000)}m`}
            </text>
          ))}
          {heapMax && (
            <g>
              <line className="memory-chart__max" x1={PAD.left} x2={width - PAD.right} y1={y(heapMax)} y2={y(heapMax)} />
              <text className="memory-chart__max-label" x={width - PAD.right} y={y(heapMax) - 6} textAnchor="end">
                Max heap {formatBytes(heapMax, 0)}
              </text>
            </g>
          )}
          <path
            className="memory-chart__area"
            d={`${path('heapLive')}L${x(visible[visible.length - 1].t)},${y(0)}L${x(visible[0].t)},${y(0)}Z`}
          />
          {SERIES.map((s) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
          ))}
          {hovered && (
            <g>
              <line className="memory-chart__crosshair" x1={x(hovered.t)} x2={x(hovered.t)} y1={PAD.top} y2={PAD.top + innerH} />
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(hovered.t)} cy={y(hovered[s.key])} r={4} fill={s.color} stroke="var(--chart-surface)" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hovered && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(x(hovered.t) + 12, width - 200), top: PAD.top }}
        >
          <div className="chart-tooltip__time">{new Date(hovered.t).toLocaleTimeString()}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="chart-tooltip__row">
              <span className="chart-tooltip__key" style={{ background: s.color }} />
              <strong>{formatBytes(hovered[s.key], 2)}</strong>
              <span className="chart-tooltip__label">{s.label}</span>
            </div>
          ))}
          {hovered.gcPausePercent !== null && (
            <div className="chart-tooltip__row chart-tooltip__row--muted">GC pauses {hovered.gcPausePercent.toFixed(2)}%</div>
          )}
        </div>
      )}
    </div>
  );
}
