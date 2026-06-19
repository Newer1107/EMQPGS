import { cn } from "@/lib/utils";

export interface ProgressBar {
  label: string;
  current: number;
  total: number;
  color?: string; // Tailwind bg class, defaults to accent
  showPercent?: boolean;
}

interface ProgressSummaryProps {
  bars: ProgressBar[];
  variant?: "default" | "compact";
  className?: string;
}

export function ProgressSummary({ bars, variant = "default", className }: ProgressSummaryProps) {
  const isCompact = variant === "compact";

  return (
    <div className={cn("space-y-3", className)}>
      {bars.map((bar, i) => {
        const pct = bar.total > 0 ? Math.round((bar.current / bar.total) * 100) : 0;
        const fillColor = bar.color ?? "bg-[var(--accent)]";

        return (
          <div key={`${bar.label}-${i}`} className="space-y-1">
            <div className={cn("flex items-center justify-between", isCompact ? "text-xs" : "text-sm")}>
              <span className="font-medium text-[var(--text-primary)]">{bar.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-secondary)] tabular-nums">
                  {bar.current}/{bar.total}
                </span>
                {(bar.showPercent ?? true) && (
                  <span
                    className={cn(
                      "tabular-nums font-medium",
                      bar.total === 0
                        ? "text-[var(--text-muted)]"
                        : "text-[var(--text-secondary)]",
                    )}
                  >
                    {pct}%
                  </span>
                )}
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div
                className={cn("h-full rounded-full transition-all", fillColor)}
                style={{ width: `${bar.total > 0 ? pct : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
