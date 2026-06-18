import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { NotificationInbox } from "@/components/moderator/notification-inbox";
import { ModeratorDashboardService } from "@/modules/moderation/dashboard.service";

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
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Summary Counts</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <p>Pending review: {data.summary.pending}</p>
            <p>Approved: {data.summary.approved}</p>
            <p>Rejected: {data.summary.rejected}</p>
            <p>Revision requested: {data.summary.revisionRequested}</p>
            <p>Awaiting revision resubmission: {data.summary.awaitingRevisionResubmission}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Questions Awaiting Revision Resubmission</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.awaitingRevisionResubmission.map((item: { id: string; subjectName: string; moduleNumber: number; markType: number; contributorName: string; revisionRequestedAt: string }) => (
              <Link key={item.id} href={`/dashboard/moderator/questions?questionId=${item.id}`} className="block rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{item.subjectName}</p>
                <p className="text-[var(--muted-foreground)]">Module {item.moduleNumber} · {item.markType}-mark · {item.contributorName}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Moderation Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.recentModerationActivity.map((item: { id: string; questionId: string; subjectName: string; action: string; timestamp: string }) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{item.subjectName}</p>
                <p className="text-[var(--muted-foreground)]">{item.action} · {new Date(item.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick-Access Bank List</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.quickAccessBanks.map((bank: { id: string; subjectName: string; examCycle: string; pendingCount: number; revisionSubmittedCount: number; urgency: number }) => (
              <Link key={bank.id} href={`/dashboard/moderator/questions?bankId=${bank.id}`} className="block rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{bank.subjectName}</p>
                <p className="text-[var(--muted-foreground)]">{bank.examCycle}</p>
                <p>{bank.pendingCount} pending · {bank.revisionSubmittedCount} revision submitted</p>
              </Link>
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
