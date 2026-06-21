import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { ModeratorDashboardService } from "@/modules/moderation/dashboard.service";
import type { Severity } from "@/components/dashboard/types";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import type { SummaryItem } from "@/components/dashboard/dashboard-header";
import { PrimaryAction } from "@/components/dashboard/primary-action";
import { AlertBanner } from "@/components/dashboard/alert-banner";
import type { AlertBannerItem } from "@/components/dashboard/alert-banner";
import { TaskQueue } from "@/components/dashboard/task-queue";
import type { QueueItem } from "@/components/dashboard/task-queue";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import type { ActivityEvent } from "@/components/dashboard/recent-activity";
import { StatCard } from "@/components/dashboard/stat-card";

export default async function ModeratorDashboardPage() {
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(actor.id, actor);
  const service = new ModeratorDashboardService();
  const data = await service.getDashboard(auth);

  const oldestPending = data.pendingQueue[0] ?? null;

  // ── DashboardHeader summary badges ──
  const summaryBadges: SummaryItem[] = [
    { label: "Pending", count: data.summary.pending, variant: "warning" },
    { label: "Awaiting Resub", count: data.summary.awaitingRevisionResubmission, variant: "info" },
    { label: "Approved", count: data.summary.approved, variant: "success" },
  ];

  // ── AlertBanner: banks with urgency > 5 ──
  const urgentBanks = data.quickAccessBanks.filter((b) => b.urgency > 5);
  const alertItems: AlertBannerItem[] = urgentBanks.map((b) => ({
    id: b.id,
    title: `${b.subjectName}`,
    description: `${b.pendingCount} pending, ${b.revisionSubmittedCount} resubmission${b.revisionSubmittedCount !== 1 ? "s" : ""}`,
    href: `/dashboard/moderator/questions?bankId=${b.id}`,
    severity: "warning" as Severity,
  }));

  // ── TaskQueue: pending items ──
  const pendingQueueItems: QueueItem[] = data.pendingQueue.map((item) => ({
    id: item.id,
    title: item.subjectName,
    subtitle: `Module ${item.moduleNumber} · ${item.marks} marks by ${item.submitterName}`,
    href: `/dashboard/moderator/questions?questionId=${item.id}`,
    badge: {
      label: `${item.priorityScore}d`,
      variant: item.priorityScore > 7 ? "danger" : item.priorityScore > 3 ? "warning" : "info",
    },
    meta: `${item.priorityScore} day${item.priorityScore !== 1 ? "s" : ""} waiting`,
    metaVariant: item.priorityScore > 7 ? "danger" : item.priorityScore > 3 ? "warning" : "default",
  }));

  // ── TaskQueue: awaiting revision items ──
  const awaitingQueueItems: QueueItem[] = data.awaitingRevisionResubmission.map((item) => {
    const daysWaiting = Math.floor(
      (Date.now() - new Date(item.revisionRequestedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      id: item.id,
      title: item.subjectName,
      subtitle: `Resubmission by ${item.contributorName}`,
      href: `/dashboard/moderator/questions?questionId=${item.id}`,
      badge: { label: "Rev Requested", variant: "info" as const },
      meta: `${daysWaiting} day${daysWaiting !== 1 ? "s" : ""}`,
    };
  });

  // ── Recent Activity ──
  const activityEvents: ActivityEvent[] = data.recentModerationActivity.map((item) => ({
    id: item.id,
    timestamp: new Date(item.timestamp),
    actor: actor.name,
    action: item.action,
    target: item.subjectName,
    href: `/dashboard/moderator/questions?questionId=${item.questionId}`,
  }));

  // ── StatCards config ──
  const statCardConfigs = [
    { value: data.summary.pending, label: "Pending", variant: "warning" as const },
    { value: data.summary.approved, label: "Approved", variant: "success" as const },
    { value: data.summary.rejected, label: "Rejected", variant: "default" as const },
    { value: data.summary.revisionRequested, label: "Rev Requested", variant: "info" as const },
  ];

  return (
    <div className="space-y-6">
      {/* 1. DashboardHeader — greeting + summary badges */}
      <DashboardHeader
        title="Moderator Dashboard"
        description="Review and moderate question submissions"
        greeting={`Welcome back, ${actor.name}`}
        summary={summaryBadges}
      />

      {/* 2. PrimaryAction — Review Oldest Pending */}
      {oldestPending && (
        <PrimaryAction
          title="Review Oldest Pending"
          description={`${oldestPending.subjectName} (${oldestPending.subjectCode}) · Module ${oldestPending.moduleNumber} · ${oldestPending.marks} marks by ${oldestPending.submitterName} · waiting ${oldestPending.priorityScore}d`}
          href={`/dashboard/moderator/questions?questionId=${oldestPending.id}`}
          variant="warning"
        />
      )}

      {/* 3. AlertBanner — urgent banks */}
      {alertItems.length > 0 && (
        <AlertBanner items={alertItems} />
      )}

      {/* 4. TaskQueue — main section */}
      <Card>
        <CardHeader>
          <CardTitle>Task Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <TaskQueue
            title="Pending Review"
            items={pendingQueueItems}
            emptyMessage="No pending questions."
          />
          <TaskQueue
            title="Awaiting Revision Resubmission"
            items={awaitingQueueItems}
            emptyMessage="No questions awaiting resubmission."
          />
        </CardContent>
      </Card>

      {/* 5. Per-bank stats table */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Bank Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          {data.perBankStats.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No bank data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--text-tertiary)] text-xs uppercase tracking-[0.08em]">
                    <th className="pb-2 pr-4 font-medium">Subject</th>
                    <th className="pb-2 pr-4 font-medium">Pending</th>
                    <th className="pb-2 pr-4 font-medium">Approved</th>
                    <th className="pb-2 pr-4 font-medium">Rejected</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perBankStats.map((stat) => (
                    <tr key={stat.bankId} className="border-t border-[var(--border)]">
                      <td className="py-2.5 pr-4 font-medium">{stat.subjectName}</td>
                      <td className="py-2.5 pr-4">{stat.pending}</td>
                      <td className="py-2.5 pr-4">{stat.approved}</td>
                      <td className="py-2.5 pr-4">{stat.rejected}</td>
                      <td className="py-2.5">
                        <Link
                          href={`/dashboard/moderator/questions?bankId=${stat.bankId}`}
                          className="text-sm underline underline-offset-4 hover:text-[var(--accent)]"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Recent Activity timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivity events={activityEvents} maxEvents={10} />
        </CardContent>
      </Card>

      {/* 7. Supporting StatCards row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCardConfigs.map((s) => (
          <StatCard key={s.label} value={s.value} label={s.label} variant={s.variant} size="sm" />
        ))}
      </div>
    </div>
  );
}
