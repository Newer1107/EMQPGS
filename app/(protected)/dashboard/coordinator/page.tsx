import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PrimaryAction } from "@/components/dashboard/primary-action";
import { AttentionSection } from "@/components/dashboard/attention-card";
import { WorkflowPipeline, type PipelinePhase, type Bottleneck } from "@/components/dashboard/workflow-pipeline";
import { TaskQueue, type QueueItem } from "@/components/dashboard/task-queue";
import { RecentActivity, type ActivityEvent } from "@/components/dashboard/recent-activity";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Severity } from "@/components/dashboard/types";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { CoordinatorService, type AttentionItem, type BankStatusItem } from "@/modules/coordinator/service";
import { questionBankPhaseLabels } from "@/lib/constants";

const ATTENTION_SEVERITY: Record<AttentionItem["type"], Severity> = {
  stalled: "critical",
  missing_moderator: "warning",
  ready_to_advance: "success",
  low_fill: "info",
};

const PHASE_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  DRAFTING: "default",
  MODERATION: "warning",
  APPROVAL: "info",
  COMPLETE: "success",
};

const PHASE_BAR_COLORS: Record<string, string> = {
  DRAFTING: "bg-sky-500",
  MODERATION: "bg-amber-500",
  APPROVAL: "bg-violet-500",
  COMPLETE: "bg-green-500",
};

function daysMetaVariant(days: number): "danger" | "warning" | "default" {
  if (days > 7) return "danger";
  if (days > 3) return "warning";
  return "default";
}

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function CoordinatorDashboardPage() {
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(actor.id, actor);
  const service = new CoordinatorService();
  const data = await service.getDashboard(auth);

  const totalBanks =
    data.phaseDistribution.drafting +
    data.phaseDistribution.moderation +
    data.phaseDistribution.approval +
    data.phaseDistribution.complete;

  // Priority-ordered attention items for PrimaryAction selection
  const bankPriorityMap = new Map(data.bankStatuses.map((b) => [b.id, b.priorityScore]));
  const sortedAttention = [...data.attentionItems].sort(
    (a, b) => (bankPriorityMap.get(b.bankId) ?? 0) - (bankPriorityMap.get(a.bankId) ?? 0),
  );

  // Top attention item → PrimaryAction hero
  const topAttention = sortedAttention[0] ?? null;
  const primaryAction = topAttention
    ? {
        title:
          topAttention.type === "missing_moderator"
            ? `Assign Moderator to ${topAttention.subject}`
            : topAttention.type === "stalled"
              ? `Review stalled bank: ${topAttention.subject} (${topAttention.subjectCode})`
              : topAttention.type === "ready_to_advance"
                ? `Advance ${topAttention.subject} (${topAttention.subjectCode})`
                : topAttention.detail,
        description: `${topAttention.detail} · ${topAttention.daysInPhase}d in ${topAttention.phase.toLowerCase()}`,
        href: `/dashboard/coordinator/question-banks/${topAttention.bankId}`,
        variant: (topAttention.type === "stalled"
          ? "warning"
          : topAttention.type === "ready_to_advance"
            ? "success"
            : "default") as "default" | "success" | "warning",
      }
    : null;

  // Remaining attention items (everything except the PrimaryAction one)
  const topKey = topAttention ? `${topAttention.bankId}-${topAttention.type}` : null;
  const mappedAttention = data.attentionItems.map((item) => ({
    id: `${item.bankId}-${item.type}`,
    title: `${item.subject} (${item.subjectCode})`,
    description: item.detail,
    href: `/dashboard/coordinator/question-banks/${item.bankId}`,
    severity: ATTENTION_SEVERITY[item.type] ?? ("info" as Severity),
  }));
  const remainingAttention = topKey
    ? mappedAttention.filter((item) => item.id !== topKey)
    : mappedAttention;

  // WorkflowPipeline phases
  const pipelinePhases: PipelinePhase[] = [
    { key: "drafting", label: "Drafting", count: data.phaseDistribution.drafting, color: PHASE_BAR_COLORS.DRAFTING },
    { key: "moderation", label: "Moderation", count: data.phaseDistribution.moderation, color: PHASE_BAR_COLORS.MODERATION },
    { key: "approval", label: "Approval", count: data.phaseDistribution.approval, color: PHASE_BAR_COLORS.APPROVAL },
    { key: "complete", label: "Complete", count: data.phaseDistribution.complete, color: PHASE_BAR_COLORS.COMPLETE },
  ];

  // Bottleneck annotations from attention data
  const stalledCount = data.attentionItems.filter((a) => a.type === "stalled").length;
  const missingModCount = data.attentionItems.filter((a) => a.type === "missing_moderator").length;
  const bottlenecks: Bottleneck[] = [];
  if (stalledCount > 0) {
    bottlenecks.push({
      label: "Stalled",
      count: stalledCount,
      description: "Banks not updated in 7+ days",
      color: "bg-rose-500",
    });
  }
  if (missingModCount > 0) {
    bottlenecks.push({
      label: "Missing Moderator",
      count: missingModCount,
      description: "Banks without an assigned moderator",
      color: "bg-amber-500",
    });
  }

  // TaskQueue: banks with priorityScore > 0, sorted by urgency
  const priorityBanks = [...data.bankStatuses]
    .filter((b) => b.priorityScore > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const queueItems: QueueItem[] = priorityBanks.map((bank) => ({
    id: bank.id,
    title: `${bank.subjectName} (${bank.subjectCode})`,
    subtitle: `${bank.nextAction}`,
    description: `${bank.filledCount}/${bank.totalSlots} filled · ${bank.approvedCount} approved · ${bank.pendingModerationCount} pending`,
    href: `/dashboard/coordinator/question-banks/${bank.id}`,
    badge: {
      label: questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase,
      variant: PHASE_BADGE_VARIANT[bank.phase] ?? "default",
    },
    meta: `${bank.daysInPhase}d in phase`,
    metaVariant: daysMetaVariant(bank.daysInPhase),
  }));

  // RecentActivity timeline from contribution data
  const activityEvents: ActivityEvent[] = data.recentContributionActivity.map((q) => ({
    id: q.id,
    timestamp: new Date(q.submittedAt),
    actor: q.contributorName,
    action: q.status.toLowerCase(),
    target: q.subjectName,
  }));

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Coordinator Dashboard"
        description="Overview of your assigned departments and active question banks."
        greeting={`${greeting(new Date().getHours())}, ${actor.name}`}
        summary={[
          { label: "Total Banks", count: data.bankStatuses.length, variant: "default" },
          {
            label: "Needs Attention",
            count: data.attentionItems.length,
            variant: data.attentionItems.length > 0 ? "warning" : "success",
          },
          { label: "Active Cycles", count: data.activeExamCycles.length, variant: "info" },
        ]}
      />

      {primaryAction && (
        <PrimaryAction
          title={primaryAction.title}
          description={primaryAction.description}
          href={primaryAction.href}
          variant={primaryAction.variant}
        />
      )}

      <AttentionSection items={remainingAttention} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Workflow Pipeline</CardTitle>
            <span className="text-xs text-[var(--text-tertiary)]">{totalBanks} total banks</span>
          </div>
        </CardHeader>
        <CardContent>
          <WorkflowPipeline
            phases={pipelinePhases}
            total={totalBanks}
            bottlenecks={bottlenecks.length > 0 ? bottlenecks : undefined}
          />
        </CardContent>
      </Card>

      <TaskQueue
        items={queueItems}
        title="Task Queue"
        emptyMessage="All banks are on track"
      />

      {/* UAF Analysis Section */}
      {data.bankStatuses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">UAF Quality Analysis</CardTitle>
              <span className="text-xs text-[var(--text-tertiary)]">Deterministic academic indices</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.bankStatuses.slice(0, 6).map((bank) => (
                <Link
                  key={bank.id}
                  href={`/dashboard/coordinator/analysis?bank=${bank.id}`}
                  className="rounded-lg border border-[var(--border)] p-4 transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <p className="text-sm font-medium">{bank.subjectName}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{bank.subjectCode}</p>
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                      View Analysis →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            {data.bankStatuses.length > 6 && (
              <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                +{data.bankStatuses.length - 6} more banks
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {data.activeExamCycles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Active Exam Cycles ({data.activeExamCycles.length})
              </CardTitle>
              <Link
                href={`/dashboard/coordinator/exam-workspace/${data.activeExamCycles[0].id}`}
              >
                <Button variant="outline" size="sm">
                  Open Workspace
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.activeExamCycles.map((cycle) => (
                <Link
                  key={cycle.id}
                  href={`/dashboard/coordinator/exam-workspace/${cycle.id}`}
                  className="rounded-lg border border-[var(--border)] p-4 transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <p className="text-sm font-medium">{cycle.name}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    <Badge variant="success">Active</Badge>

                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Contribution Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivity events={activityEvents} maxEvents={10} />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-5">
        <StatCard value={data.bankStatuses.length} label="Total Banks" size="sm" />
        <StatCard value={data.phaseDistribution.drafting} label="In Drafting" size="sm" variant="info" />
        <StatCard value={data.phaseDistribution.moderation} label="In Moderation" size="sm" variant="warning" />
        <StatCard value={data.phaseDistribution.approval} label="In Approval" size="sm" variant="info" />
        <StatCard value={data.phaseDistribution.complete} label="Complete" size="sm" variant="success" />
      </div>
    </div>
  );
}
