import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock } from "lucide-react";

export interface QueueItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  href?: string;
  badge?: {
    label: string;
    variant?: "default" | "success" | "warning" | "danger" | "info";
  };
  meta?: string;
  metaVariant?: "default" | "warning" | "danger";
}

interface TaskQueueProps {
  items: QueueItem[];
  title?: string;
  emptyMessage?: string;
  maxItems?: number;
  variant?: "default" | "compact";
  className?: string;
}

const metaStyles: Record<string, string> = {
  default: "text-[var(--text-tertiary)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
};

export function TaskQueue({
  items,
  title,
  emptyMessage = "No pending items",
  maxItems,
  variant = "default",
  className,
}: TaskQueueProps) {
  const visible = maxItems ? items.slice(0, maxItems) : items;
  const hasMore = maxItems ? items.length > maxItems : false;

  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          {items.length > 0 && (
            <span className="text-xs text-[var(--text-tertiary)]">{items.length} item{items.length !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">{emptyMessage}</p>
      ) : (
        <div className="divide-y divide-[var(--border-soft)] rounded-lg border border-[var(--border)]">
          {visible.map((item) => {
            const isCompact = variant === "compact";
            const rowContent = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--text-primary)] text-sm">
                      {item.title}
                    </span>
                    {item.badge && (
                      <Badge variant={item.badge.variant ?? "default"} className="shrink-0">
                        {item.badge.label}
                      </Badge>
                    )}
                  </div>
                  {item.subtitle && (
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {item.subtitle}
                    </p>
                  )}
                  {item.description && !isCompact && (
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)] leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.meta && (
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs whitespace-nowrap",
                        metaStyles[item.metaVariant ?? "default"],
                      )}
                    >
                      <Clock className="h-3 w-3" />
                      {item.meta}
                    </span>
                  )}
                  {item.href && (
                    <ArrowRight className="h-4 w-4 text-[var(--text-tertiary)] transition-opacity group-hover:opacity-100" />
                  )}
                </div>
              </>
            );
            const baseClass = cn(
              "flex items-start gap-3 transition-colors",
              isCompact ? "p-2" : "p-3",
              item.href && "hover:bg-[var(--surface-hover)]",
            );
            return item.href ? (
              <Link key={item.id} href={item.href} className={cn(baseClass, "group")}>
                {rowContent}
              </Link>
            ) : (
              <div key={item.id} className={baseClass}>
                {rowContent}
              </div>
            );
          })}

          {hasMore && (
            <div className="border-t border-[var(--border-soft)] px-3 py-2">
              <Link
                href="#"
                className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
              >
                View all {items.length} items
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
