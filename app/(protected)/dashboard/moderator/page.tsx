import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/auth/get-workspace-context";
import { ModeratorDashboardService } from "@/modules/moderation/dashboard.service";
import type { Severity } from "@/components/dashboard/types";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PrimaryAction } from "@/components/dashboard/primary-action";
import { AlertBanner } from "@/components/dashboard/alert-banner";
import { TaskQueue } from "@/components/dashboard/task-queue";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { StatCard } from "@/components/dashboard/stat-card";

export default async function ModeratorDashboardPage() {
  const { user, context: ctx } = await getWorkspaceContext("MODERATOR");
  const service = new ModeratorDashboardService();
  const data = await service.getDashboard(ctx);

  const oldestPending = data.pendingQueue[0] ?? null;
  const alertItems = data.summary.pending > 10
    ? [{ id: "backlog", title: `${data.summary.pending} questions pending`, description: "Review queue is growing", href: "/dashboard/moderator/questions", severity: "warning" as Severity }]
    : [];

  const pendingQueueItems = data.pendingQueue.map((item) => ({
    id: item.id,
    title: ctx.subject.subjectName,
    subtitle: `Module ${item.moduleNumber} · ${item.marks} marks by ${item.submitterName}`,
    href: `/dashboard/moderator/questions/${item.id}`,
    badge: { label: `${item.priorityScore}d`, variant: item.priorityScore > 7 ? "danger" as const : item.priorityScore > 3 ? "warning" as const : "info" as const },
    meta: `${item.priorityScore} day${item.priorityScore !== 1 ? "s" : ""} waiting`,
    metaVariant: item.priorityScore > 7 ? "danger" as const : item.priorityScore > 3 ? "warning" as const : "default" as const,
  }));

  const awaitingQueueItems = data.awaitingRevisionResubmission.map((item) => {
    const daysWaiting = Math.floor((Date.now() - new Date(item.revisionRequestedAt).getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: item.id,
      title: item.subjectName,
      subtitle: `Resubmission by ${item.contributorName}`,
      href: `/dashboard/moderator/questions/${item.id}`,
      badge: { label: "Rev Requested", variant: "info" as const },
      meta: `${daysWaiting} day${daysWaiting !== 1 ? "s" : ""}`,
    };
  });

  const activityEvents = data.recentModerationActivity.map((item) => ({
    id: item.id,
    timestamp: new Date(item.timestamp),
    actor: user.name,
    action: item.action,
    target: item.subjectName,
  }));

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={`Moderation — ${ctx.subject.subjectName}`}
        description={`${ctx.subject.subjectCode} · Semester ${ctx.batchSemester.semesterNumber} · ${ctx.batchSemester.batch.name} · ${ctx.batchSemester.academicYear.code}`}
        greeting={`Welcome back, ${user.name}`}
        summary={[
          { label: "Pending", count: data.summary.pending, variant: "warning" },
          { label: "Awaiting Resub", count: data.summary.awaitingRevisionResubmission, variant: "info" },
          { label: "Approved", count: data.summary.approved, variant: "success" },
        ]}
      />

      {oldestPending && (
        <PrimaryAction
          title="Review Oldest Pending"
          description={`${ctx.subject.subjectName} · Module ${oldestPending.moduleNumber} · ${oldestPending.marks} marks by ${oldestPending.submitterName} · waiting ${oldestPending.priorityScore}d`}
          href={`/dashboard/moderator/questions/${oldestPending.id}`}
          variant="warning"
        />
      )}

      {alertItems.length > 0 && <AlertBanner items={alertItems} />}

      <Card>
        <CardHeader><CardTitle>Review Queue — {ctx.subject.subjectName}</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <TaskQueue title="Pending Review" items={pendingQueueItems} emptyMessage="No pending questions." />
          <TaskQueue title="Awaiting Revision Resubmission" items={awaitingQueueItems} emptyMessage="No questions awaiting resubmission." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        <CardContent>
          <RecentActivity events={activityEvents} maxEvents={10} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { value: data.summary.pending, label: "Pending", variant: "warning" as const },
          { value: data.summary.approved, label: "Approved", variant: "success" as const },
          { value: data.summary.rejected, label: "Rejected", variant: "default" as const },
          { value: data.summary.revisionRequested, label: "Rev Requested", variant: "info" as const },
        ].map((s) => (
          <StatCard key={s.label} value={s.value} label={s.label} variant={s.variant} size="sm" />
        ))}
      </div>
    </div>
  );
}
