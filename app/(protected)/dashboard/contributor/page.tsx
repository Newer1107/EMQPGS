import Link from "next/link";
import { prisma } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth/get-workspace-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PrimaryAction } from "@/components/dashboard/primary-action";
import { AttentionSection } from "@/components/dashboard/attention-card";
import { ProgressSummary } from "@/components/dashboard/progress-summary";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  FileQuestion, CheckCircle2, Clock, XCircle, FileEdit, RefreshCw, PenSquare,
} from "lucide-react";

const OVERDUE_DAYS = 3;

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function statIcon(label: string) {
  const icons: Record<string, React.ElementType> = {
    Submitted: FileQuestion, Approved: CheckCircle2, Pending: Clock,
    "Revision Requested": RefreshCw, Rejected: XCircle, Draft: FileEdit,
  };
  const Icon = icons[label] ?? FileQuestion;
  return <Icon className="h-4 w-4" />;
}

export default async function ContributorDashboardPage() {
  const { user, context: ctx } = await getWorkspaceContext("CONTRIBUTOR");
  const bankId = ctx.bankId;

  const [myQuestions] = await Promise.all([
    prisma.questionLibraryItem.findMany({
      where: { createdById: user.id },
      include: {
        subjectVersion: { include: { subject: true } },
        moderationEvents: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const totalSlots = ctx.questionBank.pattern?.totalSlots ?? 126;
  const mySlotCount = ctx.questionBank.slots.filter(
    (s) => s.assignedQuestion?.ownerId === user.id,
  ).length;
  const fillPercent = totalSlots > 0 ? Math.round((mySlotCount / totalSlots) * 100) : 0;

  const stats = {
    submitted: myQuestions.filter((q) => q.status !== "DRAFT").length,
    approved: myQuestions.filter((q) => q.status === "APPROVED").length,
    pending: myQuestions.filter((q) => q.status === "PENDING" || q.status === "REVISION_SUBMITTED").length,
    revisionRequested: myQuestions.filter((q) => q.status === "REVISION_REQUESTED").length,
    rejected: myQuestions.filter((q) => q.status === "REJECTED").length,
    draft: myQuestions.filter((q) => q.status === "DRAFT").length,
  };

  const revisionQuestions = myQuestions.filter((q) => q.status === "REVISION_REQUESTED");
  const now = Date.now();
  const overdueCount = revisionQuestions.filter(
    (q) => now - q.updatedAt.getTime() > OVERDUE_DAYS * 24 * 60 * 60 * 1000,
  ).length;

  const recentFeedback = myQuestions
    .filter((q) => q.moderationEvents.length > 0 && q.moderationEvents[0].note)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={ctx.subject.subjectName}
        greeting={`${greeting(new Date().getHours())}, ${user.name}`}
        description={`${ctx.subject.subjectCode} · Semester ${ctx.batchSemester.semesterNumber} · ${ctx.batchSemester.batch.name} · ${ctx.batchSemester.academicYear.code}`}
        summary={[
          { label: "My Questions", count: myQuestions.length },
          { label: "Pending", count: stats.pending, variant: "warning" as const },
          { label: "Approved", count: stats.approved, variant: "success" as const },
        ]}
      />

      {revisionQuestions.length > 0 && (
        <PrimaryAction
          title={`${revisionQuestions.length} Revision${revisionQuestions.length > 1 ? "s" : ""} Need${revisionQuestions.length === 1 ? "s" : ""} Your Attention`}
          description={overdueCount > 0 ? `${overdueCount} overdue — update and resubmit` : "Questions awaiting your updates"}
          href="/dashboard/contributor/questions"
          variant={overdueCount > 0 ? "warning" : "default"}
        />
      )}

      {recentFeedback.length > 0 && (
        <AttentionSection
          title="Recent Feedback"
          items={recentFeedback.map((q) => ({
            id: q.id,
            title: `${q.subjectVersion.subject.subjectName} · Module ${q.moduleNumber} · ${q.marks} marks`,
            description: q.moderationEvents[0]?.note ?? "",
            href: `/dashboard/contributor/questions/${q.id}/edit`,
            severity: q.status === "REJECTED" ? "critical" : "warning" as const,
          }))}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressSummary
            bars={[{
              label: ctx.subject.subjectName,
              current: mySlotCount,
              total: totalSlots,
            }]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Submitted", value: stats.submitted },
          { label: "Approved", value: stats.approved },
          { label: "Pending", value: stats.pending },
          { label: "Revision Requested", value: stats.revisionRequested },
          { label: "Rejected", value: stats.rejected },
          { label: "Draft", value: stats.draft },
        ].map((s) => (
          <StatCard key={s.label} value={s.value} label={s.label} icon={statIcon(s.label)} size="sm" />
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={`/dashboard/contributor/submit-question?subjectVersionId=${ctx.subjectVersion?.id ?? ""}`}>
          <Button><PenSquare className="h-4 w-4" /> Submit Question</Button>
        </Link>
        <Link href="/dashboard/contributor/questions">
          <Button variant="outline">View My Questions</Button>
        </Link>
      </div>
    </div>
  );
}
