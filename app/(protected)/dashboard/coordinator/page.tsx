import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricTile } from "@/components/ui/metric-tile";
import { NextActions } from "@/components/dashboard/next-actions";
import { AttentionSection } from "@/components/dashboard/attention-card";
import type { Severity } from "@/components/dashboard/types";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { CoordinatorService, type AttentionItem, type BankStatusItem } from "@/modules/coordinator/service";
import { questionBankPhaseLabels } from "@/lib/constants";

const ATTENTION_SEVERITY: Record<AttentionItem["type"], Severity> = {
  stalled: "critical",
  missing_moderator: "warning",
  ready_to_advance: "success",
  low_fill: "info",
};


function BankCard({ bank }: { bank: BankStatusItem }) {
  const fillBarColor =
    bank.fillPercentage >= 100 ? "bg-green-500" : bank.fillPercentage >= 50 ? "bg-amber-500" : "bg-red-500";
  const phaseLabel = questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <Link href={`/dashboard/coordinator/question-banks/${bank.id}`} className="font-semibold hover:underline">
          {bank.subjectName}
        </Link>
        <Badge>{phaseLabel}</Badge>
      </div>
      <div className="mb-3 h-2 rounded-full bg-[var(--surface-hover)]">
        <div className={`h-2 rounded-full ${fillBarColor} transition-all`} style={{ width: `${bank.fillPercentage}%` }} />
      </div>
      <div className="text-sm text-[var(--text-tertiary)]">
        {bank.filledCount}/{bank.totalSlots} filled
        {" · "}{bank.approvedCount} approved
        {" · "}{bank.pendingModerationCount} pending
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <span>{bank.daysInPhase > 0 ? `${bank.daysInPhase}d in phase` : "<1d in phase"}</span>
        <span className="font-medium text-[var(--text-primary)]">{bank.nextAction}</span>
      </div>
    </div>
  );
}

export default async function CoordinatorDashboardPage() {
  const actor = await getCurrentUserFromCookies();
  const service = new CoordinatorService();
  const data = await service.getDashboard(actor);

  // Map attention items to shared format
  const attentionItems = data.attentionItems.map((item) => ({
    id: `${item.bankId}-${item.type}`,
    title: `${item.subject} (${item.subjectCode})`,
    description: item.detail,
    href: `/dashboard/coordinator/question-banks/${item.bankId}`,
    severity: ATTENTION_SEVERITY[item.type] ?? "info" as Severity,
  }));

  // Top 3 attention items as next actions, using service-calculated priorityScore
  const bankPriorityMap = new Map(data.bankStatuses.map((b) => [b.id, b.priorityScore]));
  const nextActions = [...data.attentionItems]
    .sort((a, b) => (bankPriorityMap.get(b.bankId) ?? 0) - (bankPriorityMap.get(a.bankId) ?? 0))
    .slice(0, 3)
    .map((item, idx) => ({
      id: `action-${idx}`,
      title: `${item.subjectCode}`,
      description: item.detail,
      href: `/dashboard/coordinator/question-banks/${item.bankId}`,
      priority: idx + 1,
      severity: ATTENTION_SEVERITY[item.type] ?? "info" as Severity,
    }));

  return (
    <div className="space-y-6">
      {/* ZONE 1 */}
      <PageHeader
        title="Coordinator Dashboard"
        description="Overview of your assigned departments and active question banks."
      />

      {/* ZONE 2: What Needs My Attention */}
      <AttentionSection items={attentionItems} />

      {/* ZONE 3: What Should I Do Next */}
      <NextActions actions={nextActions} max={3} />

      {/* ZONE 4: Current Workload */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile value={data.phaseDistribution.drafting} label="In Drafting" />
        <MetricTile value={data.phaseDistribution.moderation} label="In Moderation" />
        <MetricTile value={data.phaseDistribution.approval} label="In Approval" />
        <MetricTile value={data.phaseDistribution.complete} label="Complete" />
        <MetricTile value={data.bankStatuses.length} label="Total Banks" />
        <MetricTile value={data.attentionItems.length} label="Needs Attention" />
      </div>

      {/* ZONE 5: Everything Else */}
      {data.bankStatuses.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--text-tertiary)]">
          No question banks found in your assigned departments.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.bankStatuses.map((bank) => (
            <BankCard key={bank.id} bank={bank} />
          ))}
        </div>
      )}

      {data.activeExamCycles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Exam Cycles ({data.activeExamCycles.length})</CardTitle>
              <Link href={`/dashboard/coordinator/exam-workspace/${data.activeExamCycles[0].id}`}>
                <Button variant="outline" size="sm">Open Workspace</Button>
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
                    <span>{cycle.initializedBanks} banks</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Contribution Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.recentContributionActivity.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No recent contribution activity.</p>
            ) : (
              data.recentContributionActivity.map((q) => (
                <div key={q.id} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="font-medium">{q.subjectName}</p>
                  <p className="text-[var(--text-tertiary)]">{q.contributorName} &middot; {q.status}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notification Inbox</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium">Unread: {data.unreadNotificationCount}</p>
            {data.notifications.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No notifications.</p>
            ) : (
              data.notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-[var(--text-tertiary)]">{n.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
