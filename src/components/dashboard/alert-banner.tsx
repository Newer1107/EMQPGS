import Link from "next/link";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle2, AlertCircle } from "lucide-react";
import type { Severity } from "./types";

const severityConfig: Record<Severity, { icon: React.ElementType; border: string; bg: string }> = {
  critical: {
    icon: AlertTriangle,
    border: "border-l-red-500",
    bg: "bg-red-50 dark:bg-red-950/20",
  },
  warning: {
    icon: AlertCircle,
    border: "border-l-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/20",
  },
  info: {
    icon: Info,
    border: "border-l-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/20",
  },
  success: {
    icon: CheckCircle2,
    border: "border-l-green-500",
    bg: "bg-green-50 dark:bg-green-950/20",
  },
};

interface AlertBannerItem {
  id: string;
  title: string;
  description: string;
  href?: string;
  severity: Severity;
}

interface AlertBannerProps {
  items: AlertBannerItem[];
  className?: string;
}

export function AlertBanner({ items, className }: AlertBannerProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item) => {
        const config = severityConfig[item.severity] ?? severityConfig.info;
        const Icon = config.icon;
        const content = (
          <div
            className={cn(
              "flex items-start gap-3 border-l-4 border-[var(--border)] p-3 text-sm transition-colors",
              config.border,
              config.bg,
              item.href && "cursor-pointer hover:bg-[var(--surface-hover)]",
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--text-primary)]">{item.title}</p>
              <p className="mt-0.5 text-[var(--text-tertiary)]">{item.description}</p>
            </div>
          </div>
        );

        if (item.href) {
          return (
            <Link key={item.id} href={item.href}>
              {content}
            </Link>
          );
        }

        return <div key={item.id}>{content}</div>;
      })}
    </div>
  );
}

export type { AlertBannerProps, AlertBannerItem };
