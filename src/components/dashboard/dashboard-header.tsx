import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SummaryItem {
  label: string;
  count: string | number;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

interface DashboardHeaderProps {
  title: string;
  description?: string;
  greeting?: string;
  summary?: SummaryItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function DashboardHeader({
  title,
  description,
  greeting,
  summary,
  actions,
  className,
}: DashboardHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="space-y-1">
        {greeting && <p className="text-sm text-[var(--text-tertiary)]">{greeting}</p>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-[var(--text-tertiary)]">{description}</p>}
      </div>
      {summary && summary.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {summary.map((item) => (
            <Badge key={item.label} variant={item.variant ?? "default"} className="gap-1.5 px-3 py-1">
              {item.icon}
              <span className="font-semibold">{item.count}</span>
              <span className="text-[var(--text-muted)]">{item.label}</span>
            </Badge>
          ))}
        </div>
      )}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export type { DashboardHeaderProps, SummaryItem };
