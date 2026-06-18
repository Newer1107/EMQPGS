import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { NotificationInbox } from "@/components/moderator/notification-inbox";
import { ModeratorDashboardService } from "@/modules/moderation/dashboard.service";
import { cn } from "@/lib/utils";

function StatChip({ label, count, variant }: { label: string; count: number; variant?: "warning" | "success" | "danger" | "info" | "default" }) {
  const colors: Record<string, string> = {
    warning: "border-[var(--warning)]/30 text-[var(--warning)]",
    success: "border-[var(--success)]/30 text-[var(--success)]",
    danger: "border-[var(--danger)]/30 text-[var(--danger)]",
    info: "border-[var(--info)]/30 text-[var(--info)]",
    default: "text-[var(--text-secondary)]",
  };
  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm", colors[variant ?? "default"])}>
      <span className="font-medium">{count}</span>
      <span className="text-inherit opacity-80">{label}</span>
    </div>
  );
}

export default async function ModeratorDashboardPage() {
  const actor = await getCurrentUserFromCookies();
  const service = new ModeratorDashboardService();
  const data = await service.getDashboard(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderator Dashboard"
        description="Review and moderate question submissions"
      />

      <div className="flex flex-wrap gap-2">
        <StatChip label="Pending" count={data.summary.pending} variant="warning" />
        <StatChip label="Approved" count={data.summary.approved} variant="success" />
        <StatChip label="Rejected" count={data.summary.rejected} variant="danger" />
        <StatChip label="Rev Requested" count={data.summary.revisionRequested} variant="info" />
        <StatChip label="Awaiting Resub" count={data.summary.awaitingRevisionResubmission} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pending Queue by Bank</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.pendingQuestionsByBank.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No pending questions.</p>
            ) : data.pendingQuestionsByBank.map((bank: { bankId: string; subjectName: string; questions: Array<{ id: string; moduleNumber: number; marks: number; submitterName: string }>; count: number }) => (
              <details key={bank.bankId} className="group rounded-lg border border-[var(--border)]">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium hover:bg-[var(--surface-hover)]">
                  <span>{bank.subjectName} ({bank.count})</span>
                  <svg className="h-4 w-4 text-[var(--text-tertiary)] transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="border-t border-[var(--border)] px-4 py-3 space-y-2">
                  {bank.questions.map((q: { id: string; moduleNumber: number; marks: number; submitterName: string }) => (
                    <Link key={q.id} href={`/dashboard/moderator/questions?questionId=${q.id}`} className="block rounded-lg border border-[var(--border)] p-3 text-sm hover:bg-[var(--surface-hover)]">
                      <p className="font-medium">Module {q.moduleNumber} · {q.marks} marks · {q.submitterName}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Approving fills a slot in Module {q.moduleNumber}</p>
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Per-Bank Quick Stats</CardTitle></CardHeader>
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
                    {data.perBankStats.map((stat: { bankId: string; subjectName: string; pending: number; approved: number; rejected: number }) => (
                      <tr key={stat.bankId} className="border-t border-[var(--border)]">
                        <td className="py-2.5 pr-4 font-medium">{stat.subjectName}</td>
                        <td className="py-2.5 pr-4">{stat.pending}</td>
                        <td className="py-2.5 pr-4">{stat.approved}</td>
                        <td className="py-2.5 pr-4">{stat.rejected}</td>
                        <td className="py-2.5">
                          <Link href={`/dashboard/moderator/questions?bankId=${stat.bankId}`} className="text-sm underline underline-offset-4 hover:text-[var(--accent)]">
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

        <Card>
          <CardHeader><CardTitle>Questions Awaiting Revision Resubmission</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.awaitingRevisionResubmission.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No questions awaiting resubmission.</p>
            ) : data.awaitingRevisionResubmission.map((item: { id: string; subjectName: string; moduleNumber: number; markType: number; contributorName: string; revisionRequestedAt: string }) => (
              <Link key={item.id} href={`/dashboard/moderator/questions?questionId=${item.id}`} className="block rounded-lg border border-[var(--border)] p-3 hover:bg-[var(--surface-hover)]">
                <p className="font-medium">{item.subjectName}</p>
                <p className="text-[var(--text-tertiary)]">Module {item.moduleNumber} · {item.markType}-mark · {item.contributorName}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Moderation Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.recentModerationActivity.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No recent activity.</p>
            ) : data.recentModerationActivity.map((item: { id: string; questionId: string; subjectName: string; action: string; timestamp: string }) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{item.subjectName}</p>
                <p className="text-[var(--text-tertiary)]">{item.action} · {new Date(item.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Notification Inbox</CardTitle></CardHeader>
          <CardContent>
            <NotificationInbox initialNotifications={data.notifications} unreadCount={data.unreadNotificationCount} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
