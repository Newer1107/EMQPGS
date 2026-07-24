import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, RefreshCw, Clock, Send } from "lucide-react";

type ModerationEvent = {
  id: string;
  action: string;
  note: string | null;
  createdAt: Date;
  moderator: { name: string } | null;
};

const STATUS_FLOW = ["DRAFT", "PENDING", "REVISION_REQUESTED", "REVISION_SUBMITTED", "APPROVED", "REJECTED"];

const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  QUESTION_SUBMITTED: { label: "Submitted for Moderation", icon: Send, color: "text-blue-500" },
  QUESTION_APPROVED: { label: "Approved", icon: CheckCircle2, color: "text-green-500" },
  QUESTION_REJECTED: { label: "Rejected", icon: XCircle, color: "text-red-500" },
  REVISION_REQUESTED: { label: "Revision Requested", icon: RefreshCw, color: "text-amber-500" },
  REVISION_SUBMITTED: { label: "Resubmitted", icon: Send, color: "text-blue-500" },
  DRAFT_SAVED: { label: "Draft Saved", icon: Clock, color: "text-gray-400" },
};

export function ModerationTimeline({ events }: { events: ModerationEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="mb-4 text-sm font-semibold">Moderation History</h3>
      <div className="relative space-y-0">
        {events.map((event, idx) => {
          const cfg = ACTION_CONFIG[event.action] ?? { label: event.action, icon: Clock, color: "text-gray-400" };
          const Icon = cfg.icon;
          const isLast = idx === events.length - 1;
          return (
            <div key={event.id} className="relative flex gap-4 pb-6">
              {!isLast && (
                <div className="absolute left-[15px] top-8 h-full w-px bg-[var(--border)]" />
              )}
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]", cfg.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-sm font-medium">{cfg.label}</p>
                {event.note && (
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">{event.note}</p>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                  <span>{event.moderator?.name ?? "System"}</span>
                  <span>·</span>
                  <span>{new Date(event.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
