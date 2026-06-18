import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricTile } from "@/components/ui/metric-tile";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { CoordinatorService, type AttentionItem, type BankStatusItem } from "@/modules/coordinator/service";
import { questionBankPhaseLabels } from "@/lib/constants";

const SIDEBAR_STYLES: Record<AttentionItem["type"], { label: string; borderColor: string }> = {
  stalled: { label: "Stalled", borderColor: "border-l-red-500" },
  missing_moderator: { label: "Missing Moderator", borderColor: "border-l-amber-500" },
  ready_to_advance: { label: "Ready to Advance", borderColor: "border-l-green-500" },
};

function BankCard({ bank }: { bank: BankStatusItem }) {
  const fillBarColor =
    bank.fillPercentage >= 100 ? "bg-green-500" : bank.fillPercentage >= 50 ? "bg-amber-500" : "bg-red-500";
  const phaseLabel = questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <Link
          href={`/dashboard/coordinator/question-banks/${bank.id}`}
          className="font-semibold hover:underline"
        >
          {bank.subjectName}
        </Link>
        <Badge>{phaseLabel}</Badge>
      </div>
      <div className="mb-3 h-2 rounded-full bg-[var(--surface-hover)]">
        <div
          className={`h-2 rounded-full ${fillBarColor} transition-all`}
          style={{ width: `${bank.fillPercentage}%` }}
        />
      </div>
      <div className="text-sm text-[var(--text-tertiary)]">
        {bank.filledCount}/{bank.totalSlots} filled
        {" · "}{bank.approvedCount} approved
        {" · "}{bank.pendingModerationCount} pending
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <span>{bank.daysInPhase > 0 ? `${bank.daysInPhase}d in phase` : "&lt;1d in phase"}</span>
        <span className="font-medium text-[var(--text-primary)]">{bank.nextAction}</span>
      </div>
    </div>
  );
}

function AttentionSidebarItem({ item }: { item: AttentionItem }) {
  const style = SIDEBAR_STYLES[item.type] ?? { label: item.type, borderColor: "border-l-gray-400" };
  return (
    <Link
      href={`/dashboard/coordinator/question-banks/${item.bankId}`}
      className={`block rounded-lg border border-[var(--border)] border-l-4 ${style.borderColor} bg-[var(--card)] p-3 text-sm transition-colors hover:bg-[var(--surface-hover)]`}
    >
      <div className="font-medium">{item.subjectCode}</div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
        {style.label}
      </div>
      <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{item.detail}</p>
    </Link>
  );
}

export default async function CoordinatorDashboardPage() {
  const actor = await getCurrentUserFromCookies();
  const service = new CoordinatorService();
  const data = await service.getDashboard(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coordinator Dashboard"
        description="Overview of your assigned departments and active question banks."
      />

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile value={data.phaseDistribution.drafting} label="In Drafting" />
        <MetricTile value={data.phaseDistribution.moderation} label="In Moderation" />
        <MetricTile value={data.phaseDistribution.approval} label="In Approval" />
        <MetricTile value={data.phaseDistribution.complete} label="Complete" />
        <MetricTile value={data.bankStatuses.length} label="Total Banks" />
        <MetricTile value={data.attentionItems.length} label="Needs Attention" />
      </div>

      {/* Bank cards grid + attention sidebar */}
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: data.attentionItems.length > 0 ? "1fr 320px" : "1fr" }}
      >
        {/* Bank cards */}
        <div>
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
        </div>

        {/* Attention sidebar */}
        {data.attentionItems.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
              &#9888;&#65039; Needs Attention ({data.attentionItems.length})
            </h3>
            <div className="space-y-2">
              {data.attentionItems.map((item) => (
                <AttentionSidebarItem key={`${item.bankId}-${item.type}`} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active exam cycles */}
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

      {/* Bottom: activity + notifications */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Contribution Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.recentContributionActivity.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No recent contribution activity.</p>
            ) : (
              data.recentContributionActivity.map((question: { id: string; subjectName: string; contributorName: string; status: string; submittedAt: string }) => (
                <div key={question.id} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="font-medium">{question.subjectName}</p>
                  <p className="text-[var(--text-tertiary)]">{question.contributorName} &middot; {question.status}</p>
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
              data.notifications.slice(0, 5).map((notification: { id: string; title: string; message: string; createdAt: string }) => (
                <div key={notification.id} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-[var(--text-tertiary)]">{notification.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
