"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export type BannerSeverity = "critical" | "warning" | "info" | "success";

const severityConfig: Record<BannerSeverity, { icon: React.ElementType; border: string; bg: string }> = {
  critical: {
    icon: AlertTriangle,
    border: "border-l-[var(--danger-border)]",
    bg: "bg-[var(--danger-bg)]",
  },
  warning: {
    icon: AlertCircle,
    border: "border-l-[var(--warning-border)]",
    bg: "bg-[var(--warning-bg)]",
  },
  info: {
    icon: Info,
    border: "border-l-[var(--info-border)]",
    bg: "bg-[var(--info-bg)]",
  },
  success: {
    icon: CheckCircle2,
    border: "border-l-[var(--success-border)]",
    bg: "bg-[var(--success-bg)]",
  },
};

export interface EntityStatusBannerProps {
  items: Array<{
    id: string;
    title: string;
    description: string;
    href?: string;
    severity: BannerSeverity;
    actionLabel?: string;
  }>;
  className?: string;
}

export function EntityStatusBanner({ items, className }: EntityStatusBannerProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item) => {
        const config = severityConfig[item.severity] ?? severityConfig.info;
        const Icon = config.icon;
        const href = item.href;
        const hasActionLink = href && item.actionLabel;
        const isLink = href && !item.actionLabel;

        const content = (
          <div
            className={cn(
              "flex items-start gap-3 border-l-4 p-3 text-sm transition-colors",
              config.border,
              config.bg,
              isLink && "cursor-pointer hover:bg-[var(--surface-hover)]",
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--text-primary)]">{item.title}</p>
              <p className="mt-0.5 text-[var(--text-tertiary)]">{item.description}</p>
            </div>
            {hasActionLink && (
              <Link
                href={href}
                className="flex shrink-0 items-center gap-1 self-center text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                {item.actionLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        );

        if (isLink) {
          return (
            <Link key={item.id} href={href}>
              {content}
            </Link>
          );
        }

        return <div key={item.id}>{content}</div>;
      })}
    </div>
  );
}
