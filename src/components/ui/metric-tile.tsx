import { cn } from "@/lib/utils";

interface MetricTileProps {
  icon?: React.ReactNode;
  value: string | number;
  label: string;
  trend?: { direction: "up" | "down"; value: string };
  className?: string;
}

export function MetricTile({ icon, value, label, trend, className }: MetricTileProps) {
  return (
    <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center", className)}>
      {icon && <div className="mb-1 flex justify-center text-[var(--text-tertiary)]">{icon}</div>}
      <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{label}</div>
      {trend && (
        <div className={cn("mt-1 text-xs", trend.direction === "up" ? "text-green-600" : "text-red-600")}>
          {trend.direction === "up" ? "\u2191" : "\u2193"} {trend.value}
        </div>
      )}
    </div>
  );
}
