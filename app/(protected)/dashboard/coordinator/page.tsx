import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { CoordinatorService, type AttentionItem, type BankStatusItem } from "@/modules/coordinator/service";
import { questionBankPhaseLabels, recordStatusLabels } from "@/lib/constants";

const ATTENTION_LABELS: Record<AttentionItem["type"], { label: string; color: string; bg: string }> = {
  stalled: { label: "Needs Attention", color: "text-red-800", bg: "bg-red-50 border-red-200" },
  missing_moderator: { label: "Missing Moderator", color: "text-amber-800", bg: "bg-amber-50 border-amber-200" },
  ready: { label: "Ready to Advance", color: "text-green-800", bg: "bg-green-50 border-green-200" },
};

function AttentionCard({ item }: { item: AttentionItem }) {
  const info = ATTENTION_LABELS[item.type];
  return (
    <Link
      href={`/dashboard/coordinator/question-banks/${item.bankId}`}
      className={`block rounded-lg border p-3 text-sm transition-colors hover:opacity-80 ${info.bg}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{item.subjectCode}</span>
        <span className={`text-xs font-medium uppercase tracking-wider ${info.color}`}>{info.label}</span>
      </div>
      <p className="mt-1 text-[var(--foreground)]">{item.subject}</p>
      <p className="mt-0.5 text-xs opacity-75">{item.detail}</p>
    </Link>
  );
}

function PhaseStatCard({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className={`text-2xl font-bold ${color}`}>{count}</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function BankRow({ bank }: { bank: BankStatusItem }) {
  const fillColor = bank.fillPercentage >= 100 ? "text-green-600" : bank.fillPercentage >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <TR className="cursor-pointer hover:bg-[var(--muted)]">
      <TD className="font-medium">
        <Link href={`/dashboard/coordinator/question-banks/${bank.id}`} className="hover:underline">
          {bank.subjectCode}
        </Link>
      </TD>
      <TD>{bank.examType}</TD>
      <TD>
        <Badge>{questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase}</Badge>
      </TD>
      <TD className={fillColor}>
        {bank.fillPercentage}%
        <span className="text-xs text-[var(--muted-foreground)] ml-1">({bank.filledCount}/{bank.totalSlots})</span>
      </TD>
      <TD>{bank.approvedPercentage}%</TD>
      <TD>
        {bank.daysInPhase > 0 ? (
          <span className={bank.daysInPhase > 7 ? "text-red-600 font-medium" : ""}>
            {bank.daysInPhase}d
          </span>
        ) : (
          <span className="text-[var(--muted-foreground)]">&lt;1d</span>
        )}
      </TD>
      <TD>
        <Badge variant={bank.recordStatus === "LOCKED" ? "danger" : bank.recordStatus === "ACTIVE" ? "success" : "default"}>
          {recordStatusLabels[bank.recordStatus as keyof typeof recordStatusLabels] ?? bank.recordStatus}
        </Badge>
      </TD>
      <TD className="text-sm">
        <span className="text-[var(--muted-foreground)]">{bank.nextAction}</span>
      </TD>
    </TR>
  );
}

export default async function CoordinatorDashboardPage() {
  const actor = await getCurrentUserFromCookies();
  const service = new CoordinatorService();
  const data = await service.getDashboard(actor);

  const totalBanks = data.bankStatuses.length;
  const stalledCount = data.attentionItems.filter((a) => a.type === "stalled").length;
  const readyCount = data.attentionItems.filter((a) => a.type === "ready").length;
  const missingModeratorCount = data.attentionItems.filter((a) => a.type === "missing_moderator").length;
  const overdueItems = data.bankStatuses.filter((b) => b.daysInPhase > 7 && b.phase !== "COMPLETE");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coordinator Dashboard"
        description="Overview of your assigned departments and active question banks."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Active Banks</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalBanks}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">In Drafting</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{data.phaseDistribution.drafting}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">In Moderation</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600">{data.phaseDistribution.moderation}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">In Approval</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-indigo-600">{data.phaseDistribution.approval}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Completed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{data.phaseDistribution.complete}</p></CardContent>
        </Card>
      </div>

      {overdueItems.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-800">Overdue ({overdueItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {overdueItems.slice(0, 6).map((bank) => (
                <Link
                  key={bank.id}
                  href={`/dashboard/coordinator/question-banks/${bank.id}`}
                  className="rounded-lg border border-red-200 bg-white p-3 text-sm hover:bg-red-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{bank.subjectCode}</span>
                    <span className="text-xs text-red-600 font-medium">{bank.daysInPhase}d stalled</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{bank.subjectName} · {bank.phase}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
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
                  className="rounded-lg border border-[var(--border)] p-4 hover:bg-[var(--muted)] transition-colors"
                >
                  <p className="font-medium text-sm">{cycle.name}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <Badge variant="success">Active</Badge>
                    <span>{cycle.initializedBanks} banks</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.attentionItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Needs Attention ({data.attentionItems.length})
              {stalledCount > 0 && <span className="ml-2 text-xs font-normal text-red-600">({stalledCount} stalled)</span>}
              {readyCount > 0 && <span className="ml-2 text-xs font-normal text-green-600">({readyCount} ready)</span>}
              {missingModeratorCount > 0 && <span className="ml-2 text-xs font-normal text-amber-600">({missingModeratorCount} no moderator)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.attentionItems.map((item) => (
                <AttentionCard key={`${item.bankId}-${item.type}`} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Phase Distribution</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <PhaseStatCard count={data.phaseDistribution.drafting} label="Drafting" color="text-amber-600" />
          <PhaseStatCard count={data.phaseDistribution.moderation} label="Moderation" color="text-blue-600" />
          <PhaseStatCard count={data.phaseDistribution.approval} label="Approval" color="text-indigo-600" />
          <PhaseStatCard count={data.phaseDistribution.complete} label="Complete" color="text-green-600" />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Banks ({data.bankStatuses.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Subject</TH>
                  <TH>Exam Type</TH>
                  <TH>Phase</TH>
                  <TH>Fill %</TH>
                  <TH>Approved %</TH>
                  <TH>Days</TH>
                  <TH>Status</TH>
                  <TH>Next Action</TH>
                </TR>
              </THead>
              <TBody>
                {data.bankStatuses.length === 0 && (
                  <TR>
                    <TD colSpan={8} className="text-center text-[var(--muted-foreground)] py-8">
                      No question banks found in your assigned departments.
                    </TD>
                  </TR>
                )}
                {data.bankStatuses.map((bank) => (
                  <BankRow key={bank.id} bank={bank} />
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Contribution Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.recentContributionActivity.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No recent contribution activity.</p>
            ) : (
              data.recentContributionActivity.map((question: { id: string; subjectName: string; contributorName: string; status: string; submittedAt: string }) => (
                <div key={question.id} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="font-medium">{question.subjectName}</p>
                  <p className="text-[var(--muted-foreground)]">{question.contributorName} · {question.status}</p>
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
              <p className="text-sm text-[var(--muted-foreground)]">No notifications.</p>
            ) : (
              data.notifications.slice(0, 5).map((notification: { id: string; title: string; message: string; createdAt: string }) => (
                <div key={notification.id} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-[var(--muted-foreground)]">{notification.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
