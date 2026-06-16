import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { CoordinatorService, type AttentionItem, type BankStatusItem } from "@/modules/coordinator/service";
import { questionBankPhaseLabels, recordStatusLabels } from "@/lib/constants";

const ATTENTION_LABELS: Record<AttentionItem["type"], { label: string; color: string }> = {
  stalled: { label: "Stalled", color: "bg-red-50 border-red-200 text-red-800" },
  missing_moderator: { label: "Missing Moderator", color: "bg-amber-50 border-amber-200 text-amber-800" },
  ready: { label: "Ready to Advance", color: "bg-green-50 border-green-200 text-green-800" },
};

function AttentionCard({ item }: { item: AttentionItem }) {
  const info = ATTENTION_LABELS[item.type];
  return (
    <Link
      href={`/dashboard/coordinator/question-banks/${item.bankId}`}
      className={`block rounded-lg border p-3 text-sm transition-colors hover:opacity-80 ${info.color}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{item.subjectCode}</span>
        <span className="text-xs font-medium uppercase tracking-wider">{info.label}</span>
      </div>
      <p className="mt-1 text-[var(--foreground)]">{item.subject}</p>
      <p className="mt-0.5 text-xs opacity-75">{item.detail}</p>
    </Link>
  );
}

function PhaseStatCard({ count, label }: { count: number; label: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function BankRow({ bank }: { bank: BankStatusItem }) {
  const fillColor =
    bank.fillPercentage >= 100
      ? "text-green-600"
      : bank.fillPercentage >= 50
        ? "text-amber-600"
        : "text-red-600";

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
        <Badge className={bank.recordStatus === "LOCKED" ? "bg-red-100 text-red-800 border-red-300" : ""}>
          {recordStatusLabels[bank.recordStatus as keyof typeof recordStatusLabels] ?? bank.recordStatus}
        </Badge>
      </TD>
      <TD className="text-sm">{bank.nextAction}</TD>
    </TR>
  );
}

export default async function CoordinatorDashboardPage() {
  const actor = await getCurrentUserFromCookies();
  const service = new CoordinatorService();
  const data = await service.getDashboard(actor);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Coordinator Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Department-scoped operations overview for your assigned departments only.</p>
      </div>

      {data.attentionItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Needs Attention ({data.attentionItems.length})</CardTitle>
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
        <div className="grid grid-cols-4 gap-4">
          <PhaseStatCard count={data.phaseDistribution.drafting} label="Drafting" />
          <PhaseStatCard count={data.phaseDistribution.moderation} label="Moderation" />
          <PhaseStatCard count={data.phaseDistribution.approval} label="Approval" />
          <PhaseStatCard count={data.phaseDistribution.complete} label="Complete" />
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
                {data.bankStatuses.map((bank) => (
                  <BankRow key={bank.id} bank={bank} />
                ))}
                {data.bankStatuses.length === 0 && (
                  <TR>
                    <TD colSpan={8} className="text-center text-[var(--muted-foreground)] py-8">
                      No question banks found in your assigned departments.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Contribution Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.recentContributionActivity.map((question: { id: string; subjectName: string; contributorName: string; status: string; submittedAt: string }) => (
              <div key={question.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{question.subjectName}</p>
                <p className="text-[var(--muted-foreground)]">{question.contributorName} · {question.status}</p>
              </div>
            ))}
            {data.recentContributionActivity.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">No recent contribution activity.</p>
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
              data.notifications.map((notification: { id: string; title: string; message: string; type: string; actionUrl: string | null; isRead: boolean; createdAt: string }) => (
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
