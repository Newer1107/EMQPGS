import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

const variantBorder = {
  default: "border-[var(--border)]",
  success: "border-green-500/30",
  warning: "border-amber-500/30",
  info: "border-blue-500/30",
} as const;

interface ActionPanelAction {
  id: string;
  title: string;
  description: string;
  href: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "info";
}

interface ActionPanelProps {
  actions: ActionPanelAction[];
  title?: string;
  className?: string;
}

export function ActionPanel({ actions, title, className }: ActionPanelProps) {
  if (actions.length === 0) return null;

  const gridCols =
    actions.length === 1
      ? "sm:grid-cols-1"
      : actions.length === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 xl:grid-cols-4";

  return (
    <section className={cn("space-y-3", className)}>
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      <div className={cn("grid gap-3", gridCols)}>
        {actions.map((action) => {
          const border = variantBorder[action.variant ?? "default"];
          return (
            <Link
              key={action.id}
              href={action.href}
              className={cn(
                "group flex items-start gap-3 rounded-lg border bg-[var(--card)] p-4 transition-colors hover:bg-[var(--surface-hover)]",
                border,
              )}
            >
              {action.icon && (
                <div className="mt-0.5 shrink-0 text-[var(--text-tertiary)]">{action.icon}</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{action.title}</p>
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{action.description}</p>
              </div>
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export type { ActionPanelProps, ActionPanelAction };
