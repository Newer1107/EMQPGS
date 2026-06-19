import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export interface PipelinePhase {
  key: string;
  label: string;
  count: number;
  color: string; // Tailwind bg- class, e.g. "bg-sky-500"
}

export interface Bottleneck {
  label: string;
  count: number;
  description: string;
  color: string; // Tailwind bg- class for dot, e.g. "bg-rose-500"
}

interface WorkflowPipelineProps {
  phases: PipelinePhase[];
  total: number;
  bottlenecks?: Bottleneck[];
  className?: string;
}

export function WorkflowPipeline({ phases, total, bottlenecks, className }: WorkflowPipelineProps) {
  const isEmpty = total === 0 || phases.every((p) => p.count === 0);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
        {isEmpty ? (
          <div className="h-full w-full bg-[var(--surface-hover)]" />
        ) : (
          phases.map((phase) => {
            const pct = (phase.count / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={phase.key}
                className="transition-all"
                style={{ width: `${pct}%` }}
                title={`${phase.label}: ${phase.count} (${Math.round(pct)}%)`}
              >
                <div className={cn("h-full", phase.color)} />
              </div>
            );
          })
        )}
      </div>

      {/* Phase labels */}
      {isEmpty ? (
        <p className="text-xs text-[var(--text-tertiary)] text-center py-1">No data</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {phases.map((phase) => {
            const pct = total > 0 ? Math.round((phase.count / total) * 100) : 0;
            return (
              <div key={phase.key} className="flex items-center gap-1.5">
                <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", phase.color)} />
                <span className="font-medium text-[var(--text-secondary)]">{phase.label}</span>
                <span className="text-[var(--text-tertiary)]">
                  {phase.count}
                  {pct > 0 && <span> ({pct}%)</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottleneck annotations */}
      {bottlenecks && bottlenecks.length > 0 && (
        <div className="space-y-1.5 border-t border-[var(--border-soft)] pt-2">
          {bottlenecks.map((b, i) => (
            <div key={`${b.label}-${i}`} className="flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", b.color)} />
                  <span className="font-medium text-[var(--text-primary)]">{b.label}</span>
                  <span className="rounded bg-[var(--surface-hover)] px-1 py-0.5 font-medium text-[var(--text-secondary)]">
                    {b.count}
                  </span>
                </div>
                <p className="text-[var(--text-tertiary)]">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
