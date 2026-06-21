"use client";

type DistributionBarProps = {
  label: string;
  value: number;
  max: number;
  color?: string;
  showLabel?: boolean;
};

const COLORS = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
};

function pickColor(value: number, max: number): string {
  const pct = max > 0 ? (value / max) * 100 : 0;
  if (pct >= 80) return COLORS.green;
  if (pct >= 60) return COLORS.amber;
  return COLORS.red;
}

export function DistributionBar({ label, value, max, color, showLabel = true }: DistributionBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barColor = color ?? pickColor(value, max);

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-secondary)]">{label}</span>
          <span className="font-medium tabular-nums" style={{ color: barColor }}>
            {value}/{max} ({pct}%)
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

export function DistributionBarGroup({ items, title }: { items: DistributionBarProps[]; title?: string }) {
  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>}
      {items.map((item) => (
        <DistributionBar key={item.label} {...item} />
      ))}
    </div>
  );
}
