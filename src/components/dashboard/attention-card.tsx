import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Severity } from "./types";

const severityStyles: Record<Severity, { border: string; badge: string; label: string }> = {
  critical: { border: "border-l-red-500", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Critical" },
  warning: { border: "border-l-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", label: "Warning" },
  info: { border: "border-l-blue-500", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", label: "Info" },
  success: { border: "border-l-green-500", badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", label: "Success" },
};

interface AttentionCardProps {
  href: string;
  title: string;
  description: string;
  severity: Severity;
  metadata?: Record<string, string>;
}

export function AttentionCard({ href, title, description, severity, metadata }: AttentionCardProps) {
  const style = severityStyles[severity] ?? severityStyles.info;
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg border border-[var(--border)] border-l-4 bg-[var(--card)] p-3 text-sm transition-colors hover:bg-[var(--surface-hover)]",
        style.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[var(--text-primary)]">{title}</span>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", style.badge)}>
          {style.label}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{description}</p>
      {metadata && Object.keys(metadata).length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-tertiary)]">
          {Object.entries(metadata).map(([key, val]) => (
            <span key={key}>
              {key}: <span className="font-medium text-[var(--text-secondary)]">{val}</span>
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

interface AttentionSectionProps {
  items: AttentionCardProps[];
  emptyMessage?: string;
  title?: string;
}

export function AttentionSection({ items, emptyMessage, title = "What Needs My Attention" }: AttentionSectionProps) {
  if (items.length === 0 && !emptyMessage) return null;
  return (
    <section className="space-y-3">
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      {items.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">{emptyMessage}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, idx) => (
            <AttentionCard key={`${item.href}-${idx}`} {...item} />
          ))}
        </div>
      )}
    </section>
  );
}
