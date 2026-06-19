import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { NotificationInbox } from "@/components/moderator/notification-inbox";
import { NextActions } from "@/components/dashboard/next-actions";
import { AttentionSection } from "@/components/dashboard/attention-card";
import type { Severity } from "@/components/dashboard/types";
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

  // Filter oldest pending out of queue shown below (already in attention + next actions)
  const oldestPending = data.pendingQueue[0] ?? null;
  const remainingQueue = data.pendingQueue.filter((item) => !oldestPending || item.id !== oldestPending.id);

  const attentionItems = oldestPending ? [{
    id: "oldest-pending",
    title: `Oldest Pending: ${oldestPending.subjectName} (${oldestPending.subjectCode})`,
    description: `Module ${oldestPending.moduleNumber} · ${oldestPending.marks} marks by ${oldestPending.submitterName} · waiting ${oldestPending.priorityScore}d`,
    href: `/dashboard/moderator/questions?questionId=${oldestPending.id}`,
    severity: "warning" as const,
  }] : [];

  // Next actions: highest priority pending + banks closest to readiness
  const nextActions: Array<{ id: string; title: string; description: string; href: string; priority: number; severity: Severity }> = [
    ...(oldestPending ? [{
      id: "start-reviewing",
      title: `Review: ${oldestPending.subjectCode} · ${oldestPending.subjectName}`,
      description: `Oldest pending — Module ${oldestPending.moduleNumber}, ${oldestPending.marks} marks by ${oldestPending.submitterName}`,
      href: `/dashboard/moderator/questions?questionId=${oldestPending.id}`,
      priority: 1,
      severity: "warning" as Severity,
    }] : []),
    ...data.quickAccessBanks
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 2)
      .map((bank, idx) => ({
        id: `quick-${bank.id}`,
        title: `${bank.subjectName}`,
        description: `${bank.pendingCount} pending, ${bank.revisionSubmittedCount} revision${bank.revisionSubmittedCount !== 1 ? "s" : ""} submitted`,
        href: `/dashboard/moderator/questions?bankId=${bank.id}`,
        priority: idx + 2,
        severity: (bank.urgency > 5 ? "warning" : "info") as Severity,
      })),
  ];

  return (
    <div className="space-y-6">
      {/* ZONE 1 */}
      <PageHeader
        title="Moderator Dashboard"
        description="Review and moderate question submissions"
      />

      {/* ZONE 2: What Needs My Attention */}
      <AttentionSection items={attentionItems} />

      {/* ZONE 3: What Should I Do Next */}
      <NextActions actions={nextActions} max={3} />

      {/* ZONE 4: Current Workload */}
      <div className="flex flex-wrap gap-2">
        <StatChip label="Pending" count={data.summary.pending} variant="warning" />
        <StatChip label="Approved" count={data.summary.approved} variant="success" />
        <StatChip label="Rejected" count={data.summary.rejected} variant="danger" />
        <StatChip label="Rev Requested" count={data.summary.revisionRequested} variant="info" />
        <StatChip label="Awaiting Resub" count={data.summary.awaitingRevisionResubmission} />
      </div>

      {/* ZONE 5: Everything Else */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Flat pending queue */}
        <Card>
          <CardHeader><CardTitle>Pending Queue ({remainingQueue.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {remainingQueue.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No pending questions.</p>
            ) : (
              remainingQueue.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/moderator/questions?questionId=${item.id}`}
                  className="block rounded-lg border border-[var(--border)] p-3 text-sm hover:bg-[var(--surface-hover)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.subjectName} ({item.subjectCode})</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Module {item.moduleNumber} · {item.marks} marks · {item.submitterName}
                      </p>
                    </div>
                    <Badge variant={item.priorityScore > 7 ? "danger" : item.priorityScore > 3 ? "warning" : "info"}>
                      {item.priorityScore}d
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Banks closest to readiness */}
        <Card>
          <CardHeader><CardTitle>Banks Closest to Readiness</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.quickAccessBanks.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No bank data available.</p>
            ) : (
              data.quickAccessBanks
                .sort((a, b) => b.urgency - a.urgency)
                .slice(0, 5)
                .map((bank) => (
                  <Link
                    key={bank.id}
                    href={`/dashboard/moderator/questions?bankId=${bank.id}`}
                    className="block rounded-lg border border-[var(--border)] p-3 text-sm hover:bg-[var(--surface-hover)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{bank.subjectName}</span>
                      <Badge variant={bank.urgency > 5 ? "danger" : "info"}>{bank.urgency} urgent</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                      {bank.pendingCount} pending · {bank.revisionSubmittedCount} awaiting resubmission
                    </p>
                  </Link>
                ))
            )}
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
                    {data.perBankStats.map((stat) => (
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
            ) : data.awaitingRevisionResubmission.map((item) => (
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
            ) : data.recentModerationActivity.map((item) => (
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
