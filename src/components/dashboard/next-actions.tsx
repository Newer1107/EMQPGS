import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Severity } from "./types";
import { ArrowRight, AlertTriangle, Clock, Info, CheckCircle2 } from "lucide-react";

const severityConfig: Record<Severity, { icon: React.ElementType; border: string; buttonVariant: "destructive" | "default" | "secondary" | "outline" }> = {
  critical: { icon: AlertTriangle, border: "border-l-red-500", buttonVariant: "destructive" },
  warning: { icon: Clock, border: "border-l-amber-500", buttonVariant: "default" },
  info: { icon: Info, border: "border-l-blue-500", buttonVariant: "secondary" },
  success: { icon: CheckCircle2, border: "border-l-green-500", buttonVariant: "outline" },
};

interface Action {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: number;
  severity: Severity;
}

interface NextActionsProps {
  actions: Action[];
  max?: number;
  title?: string;
}

export function NextActions({ actions, max = 3, title = "What Should I Do Next" }: NextActionsProps) {
  const sorted = [...actions].sort((a, b) => a.priority - b.priority).slice(0, max);
  if (sorted.length === 0) return null;

  return (
    <section className="space-y-3">
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((action) => {
          const config = severityConfig[action.severity] ?? severityConfig.info;
          const Icon = config.icon;
          return (
            <Link
              key={action.id}
              href={action.href}
              className={cn(
                "group relative flex flex-col rounded-lg border border-[var(--border)] border-l-4 bg-[var(--card)] p-4 transition-colors hover:bg-[var(--surface-hover)]",
                config.border,
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-tertiary)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{action.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{action.description}</p>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function PrimaryAction({ href, label, description }: { href: string; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
        {description && <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{description}</p>}
      </div>
      <Link href={href}>
        <Button size="sm">
          {label}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}
