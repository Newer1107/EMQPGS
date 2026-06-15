import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { CoordinatorService } from "@/modules/coordinator/service";

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
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Assigned Departments</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.assignedDepartments.map((department: { id: string; name: string; activeSubjects: number; activeQuestionBanks: number }) => (
              <div key={department.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{department.name}</p>
                <p className="text-[var(--muted-foreground)]">{department.activeSubjects} active subjects · {department.activeQuestionBanks} active question banks</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Active Exam Cycles</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.activeExamCycles.map((cycle: { id: string; name: string; startDate: string | null; endDate: string | null; department: string; initializedBanks: number }) => (
              <div key={cycle.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{cycle.name}</p>
                <p className="text-[var(--muted-foreground)]">{cycle.department} · {cycle.initializedBanks} banks initialized</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Per-Subject Bank Fill Status</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.subjectBankStatuses.map((bank: { id: string; subjectName: string; subjectCode: string; department: string; examCycle: string; totalSlots: number; filledCount: number; approvedCount: number; pendingModerationCount: number; rejectedCount: number; fillPercentage: number }) => (
              <div key={bank.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{bank.subjectCode} · {bank.subjectName}</p>
                <p className="text-[var(--muted-foreground)]">{bank.department} · {bank.examCycle}</p>
                <p>{bank.filledCount}/{bank.totalSlots} filled · {bank.approvedCount} approved · {bank.pendingModerationCount} pending · {bank.rejectedCount} rejected</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Contribution Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.recentContributionActivity.map((question: { id: string; subjectName: string; contributorName: string; status: string; submittedAt: string }) => (
              <div key={question.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{question.subjectName}</p>
                <p className="text-[var(--muted-foreground)]">{question.contributorName} · {question.status}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pending Teacher Assignments</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.pendingTeacherAssignments.map((item: { bankId: string; subjectName: string; moduleNumber: number }) => (
              <div key={`${item.bankId}-${item.moduleNumber}`} className="rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{item.subjectName}</p>
                <p className="text-[var(--muted-foreground)]">Module {item.moduleNumber}</p>
              </div>
            ))}
            <Link href="/dashboard/coordinator/assignments" className="inline-flex text-sm font-medium text-[var(--foreground)] hover:underline">
              Open assignment matrix &rarr;
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Notification Inbox</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium">Unread: {data.unreadNotificationCount}</p>
            {data.notifications.map((notification: { id: string; title: string; message: string; type: string; actionUrl: string | null; isRead: boolean; createdAt: string }) => (
              <div key={notification.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="font-medium">{notification.title}</p>
                <p className="text-[var(--muted-foreground)]">{notification.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
