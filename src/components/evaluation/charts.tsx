"use client";

// ── Simple SVG Chart Primitives ──────────────────────────────────
// No chart library needed. Pure SVG for bar charts, heatmaps, gauges.

// ── Horizontal Bar Chart ─────────────────────────────────────────

export function BarChart({ data, maxValue, height = 200, color = "var(--accent)" }: {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  height?: number;
  color?: string;
}) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const barHeight = Math.max(20, Math.min(32, (height - data.length * 8) / data.length));
  const totalHeight = data.length * (barHeight + 8);

  return (
    <svg width="100%" height={totalHeight} className="overflow-visible">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const y = i * (barHeight + 8);
        return (
          <g key={d.label}>
            <text x={0} y={y + barHeight / 2 + 4} textAnchor="start" className="fill-[var(--text-secondary)] text-[11px]">
              {d.label}
            </text>
            <rect
              x={80}
              y={y}
              width={`${pct}%`}
              height={barHeight}
              rx={3}
              fill={d.color ?? color}
              className="transition-all duration-300"
            />
            <text x={Math.max(80 + pct * 2, 84)} y={y + barHeight / 2 + 4} textAnchor="start" className="fill-[var(--text-primary)] text-[11px] font-medium">
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Stacked Bar Chart ────────────────────────────────────────────

export function StackedBarChart({ segments, height = 32 }: {
  segments: { label: string; value: number; color: string }[];
  height?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-full flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]" style={{ height }}>
        {segments.map((seg) => {
          const pct = (seg.value / total) * 100;
          if (pct < 0.5) return null;
          const start = offset;
          offset += pct;
          return (
            <div
              key={seg.label}
              className="transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: seg.color, marginLeft: start === 0 ? undefined : 0 }}
              title={`${seg.label}: ${seg.value}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Gauge / Score Meter ──────────────────────────────────────────

export function ScoreGauge({ score, size = 100, thresholds }: {
  score: number; // 0-1
  size?: number;
  thresholds?: { low: number; medium: number };
}) {
  const tLow = thresholds?.low ?? 0.4;
  const tMed = thresholds?.medium ?? 0.7;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, score));

  const color = score >= tMed ? "#22c55e" : score >= tLow ? "#eab308" : "#ef4444";
  const pct = Math.round(progress * 100);

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-hover)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Heatmap (simple grid) ────────────────────────────────────────

export function HeatmapGrid({ data, cellSize = 28 }: {
  data: { row: string; col: string; value: number; maxValue?: number }[];
  cellSize?: number;
}) {
  const rows = [...new Set(data.map((d) => d.row))];
  const cols = [...new Set(data.map((d) => d.col))];

  return (
    <div className="inline-block">
      {/* Header row */}
      <div className="flex items-end mb-1">
        <div style={{ width: cellSize * 1.5 }} />
        {cols.map((col) => (
          <div key={col} className="text-center text-[10px] text-[var(--text-tertiary)]" style={{ width: cellSize }}>
            {col}
          </div>
        ))}
      </div>

      {rows.map((row) => (
        <div key={row} className="flex items-center mb-0.5">
          <div className="text-[10px] text-[var(--text-tertiary)] pr-1 text-right" style={{ width: cellSize * 1.5 }}>
            {row}
          </div>
          {cols.map((col) => {
            const cell = data.find((d) => d.row === row && d.col === col);
            const value = cell?.value ?? 0;
            const maxV = cell?.maxValue ?? Math.max(...data.map((d) => d.value), 1);
            const intensity = maxV > 0 ? value / maxV : 0;
            const bg = value > 0
              ? `rgba(59, 130, 246, ${0.1 + intensity * 0.7})`
              : "var(--surface-hover)";

            return (
              <div
                key={`${row}-${col}`}
                className="flex items-center justify-center rounded text-[10px] font-medium"
                style={{ width: cellSize, height: cellSize, backgroundColor: bg, color: intensity > 0.5 ? "#fff" : "var(--text-secondary)" }}
                title={`${row} × ${col}: ${value}`}
              >
                {value > 0 ? value : ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Radar / Spider Chart ─────────────────────────────────────────

export function RadarChart({ data, size = 200, levels = 4, maxValue }: {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  levels?: number;
  maxValue?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;

  // Grid lines
  const gridLines = Array.from({ length: levels }, (_, i) => {
    const level = ((i + 1) / levels) * r;
    const points = data.map((_, j) => {
      const a = -Math.PI / 2 + j * angleStep;
      return `${cx + level * Math.cos(a)},${cy + level * Math.sin(a)}`;
    }).join(" ");
    return points;
  });

  // Data polygon
  const dataPoints = data.map((d, i) => {
    const a = -Math.PI / 2 + i * angleStep;
    const val = (d.value / max) * r;
    return `${cx + val * Math.cos(a)},${cy + val * Math.sin(a)}`;
  }).join(" ");

  return (
    <svg width={size} height={size} className="overflow-visible">
      {/* Grid */}
      {gridLines.map((points, i) => (
        <polygon key={`grid-${i}`} points={points} fill="none" stroke="var(--border)" strokeWidth={1} />
      ))}
      {/* Axes */}
      {data.map((d, i) => {
        const a = -Math.PI / 2 + i * angleStep;
        return (
          <line key={`axis-${i}`} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="var(--border)" strokeWidth={1} />
        );
      })}
      {/* Data */}
      <polygon points={dataPoints} fill="rgba(59, 130, 246, 0.15)" stroke="#3b82f6" strokeWidth={2} />
      {/* Labels */}
      {data.map((d, i) => {
        const a = -Math.PI / 2 + i * angleStep;
        const lx = cx + (r + 20) * Math.cos(a);
        const ly = cy + (r + 20) * Math.sin(a);
        return (
          <text
            key={`label-${i}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--text-secondary)] text-[10px]"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Legend ───────────────────────────────────────────────────────

export function ChartLegend({ items }: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
