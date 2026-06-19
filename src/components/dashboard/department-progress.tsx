import Link from "next/link";
import { cn } from "@/lib/utils";

export interface DepartmentProgressItem {
  name: string;
  phaseCounts: Record<string, number>;
  total: number;
  href?: string;
}

export interface DepartmentProgressProps {
  departments: DepartmentProgressItem[];
  phaseOrder: string[];
  phaseLabels: Record<string, string>;
  phaseColors: Record<string, string>;
  className?: string;
}

interface BarSegment {
  label: string;
  count: number;
  pct: number;
  color: string;
}

function buildSegments(
  dept: DepartmentProgressItem,
  phaseOrder: string[],
  phaseColors: Record<string, string>,
  phaseLabels: Record<string, string>,
): BarSegment[] {
  return phaseOrder
    .filter((p) => phaseColors[p])
    .map((phase) => ({
      label: phaseLabels[phase] ?? phase,
      count: dept.phaseCounts[phase] ?? 0,
      pct: dept.total > 0 ? (dept.phaseCounts[phase] ?? 0) / dept.total : 0,
      color: phaseColors[phase],
    }));
}

export function DepartmentProgress({
  departments,
  phaseOrder,
  phaseLabels,
  phaseColors,
  className,
}: DepartmentProgressProps) {
  if (departments.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
        <p className="text-sm text-[var(--text-tertiary)]">No department data yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="divide-y divide-[var(--border-soft)]">
        {departments.map((dept) => {
          const segments = buildSegments(dept, phaseOrder, phaseColors, phaseLabels);

          const rowClasses = cn(
            "flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:gap-3",
            dept.href && "transition-colors hover:bg-[var(--surface-hover)] -mx-2 px-2 rounded",
          );

          return dept.href ? (
            <Link key={dept.name} href={dept.href} className={rowClasses}>
              <RowContent dept={dept} segments={segments} />
            </Link>
          ) : (
            <div key={dept.name} className={rowClasses}>
              <RowContent dept={dept} segments={segments} />
            </div>
          );
        })}
      </div>

      {/* Phase legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
        {phaseOrder.map((phase) => {
          if (!phaseColors[phase]) return null;
          return (
            <div key={phase} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <span className={cn("inline-block h-2 w-2 rounded-full", phaseColors[phase])} />
              {phaseLabels[phase] ?? phase}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RowContent({
  dept,
  segments,
}: {
  dept: DepartmentProgressItem;
  segments: BarSegment[];
}) {
  return (
    <>
      <span className="text-sm font-medium text-[var(--text-primary)] sm:w-44 sm:shrink-0 sm:truncate">
        {dept.name}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
          {dept.total > 0 ? (
            <div className="flex h-full">
              {segments.map((seg) =>
                seg.count > 0 ? (
                  <div
                    key={seg.label}
                    className="h-full transition-all"
                    style={{ width: `${Math.max(seg.pct * 100, seg.count > 0 ? 2 : 0)}%` }}
                    title={`${seg.label}: ${seg.count}`}
                  >
                    <div className={cn("h-full w-full", seg.color)} />
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <div className="h-full w-full bg-[var(--surface-secondary)] opacity-40" />
          )}
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
          {dept.total}
        </span>
      </div>
    </>
  );
}
