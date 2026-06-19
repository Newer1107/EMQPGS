import Link from "next/link";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/dashboard-utils";

export interface ActivityEvent {
  id: string;
  timestamp: Date;
  actor: string;
  action: string;
  target?: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface RecentActivityProps {
  events: ActivityEvent[];
  maxEvents?: number;
  viewAllHref?: string;
  className?: string;
}

/* ponytail: static map, fine for known domain verbs. Extend via icon prop for custom actions. */
const actionDotColors: Record<string, string> = {
  approved: "bg-[var(--success)]",
  rejected: "bg-[var(--danger)]",
  submitted: "bg-[var(--info)]",
  created: "bg-[var(--info)]",
  completed: "bg-[var(--success)]",
  published: "bg-[var(--success)]",
  assigned: "bg-[var(--warning)]",
  escalated: "bg-[var(--danger)]",
  reviewed: "bg-[var(--info)]",
};

function dotColor(action: string): string {
  const lower = action.toLowerCase();
  for (const [key, color] of Object.entries(actionDotColors)) {
    if (lower === key || lower.startsWith(key)) return color;
  }
  return "bg-[var(--text-tertiary)]";
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDateHeading(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function dateLabel(d: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (+target === +today) return "Today";
  if (+target === +yesterday) return "Yesterday";
  return formatDateHeading(d);
}

function groupByDate(events: ActivityEvent[]): [string, ActivityEvent[]][] {
  const map = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const label = dateLabel(e.timestamp);
    const list = map.get(label) ?? [];
    list.push(e);
    map.set(label, list);
  }
  return Array.from(map.entries());
}

export function RecentActivity({ events, maxEvents, viewAllHref, className }: RecentActivityProps) {
  const sorted = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const display = maxEvents ? sorted.slice(0, maxEvents) : sorted;
  const hasMore = maxEvents != null && sorted.length > maxEvents;

  if (display.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
        <p className="text-sm text-[var(--text-tertiary)]">No recent activity</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      {groupByDate(display).map(([label, items]) => (
        <div key={label}>
          <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {label}
          </h4>
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="pointer-events-none absolute left-[11px] top-[9px] bottom-[9px] w-px bg-[var(--border-soft)]" />

            <div className="space-y-0">
              {items.map((event) => (
                <div key={event.id} className="group relative flex gap-3 pb-3.5 last:pb-0">
                  {/* Dot */}
                  <div className="relative z-10 mt-[5px] flex shrink-0">
                    {event.icon ?? (
                      <span
                        className={cn(
                          "block h-[10px] w-[10px] rounded-full ring-2 ring-[var(--card)]",
                          dotColor(event.action),
                        )}
                      />
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex min-w-0 flex-1 items-baseline gap-1.5 text-sm">
                    {event.href ? (
                      <Link
                        href={event.href}
                        className="truncate font-medium text-[var(--text-primary)] hover:underline"
                      >
                        {event.actor}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-[var(--text-primary)]">
                        {event.actor}
                      </span>
                    )}
                    <span className="shrink-0 text-[var(--text-tertiary)]">{event.action}</span>
                    {event.target && (
                      <span className="truncate text-[var(--text-secondary)]">{event.target}</span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span
                    className="shrink-0 self-center text-xs tabular-nums text-[var(--text-tertiary)]"
                    title={timeAgo(event.timestamp)}
                  >
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {hasMore && viewAllHref && (
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          View all
          <span className="text-[var(--text-tertiary)]">→</span>
        </Link>
      )}
    </div>
  );
}
