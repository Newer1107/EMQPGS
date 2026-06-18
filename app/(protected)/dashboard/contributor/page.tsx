import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { getContributorAssignedBanks } from "@/lib/server-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricTile } from "@/components/ui/metric-tile";
import { questionBankPhaseLabels, questionStatusLabels } from "@/lib/constants";
import {
  AlertTriangle,
  FileQuestion,
  CheckCircle2,
  Clock,
  XCircle,
  FileEdit,
  RefreshCw,
  PenSquare,
  Eye,
} from "lucide-react";

export default async function ContributorDashboardPage() {
  const actor = await getCurrentUserFromCookies();
  const banks = await getContributorAssignedBanks(actor.id);

  const [myQuestions] = await Promise.all([
    prisma.questionLibraryItem.findMany({
      where: { createdById: actor.id },
      include: {
        subjectVersion: { include: { subject: true } },
        moderationEvents: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const banksWithSlots = banks.map((b) => ({
    ...b,
    emptySlotCount: b.slots.filter((s) => !s.assignedQuestion).length,
  }));

  const totalEmptySlots = banksWithSlots.reduce((sum, b) => sum + b.emptySlotCount, 0);
  const maxEmptySlots = banksWithSlots.length > 0
    ? Math.max(...banksWithSlots.map((b) => b.emptySlotCount))
    : 0;

  const stats = {
    submitted: myQuestions.filter((q) => q.status !== "DRAFT").length,
    approved: myQuestions.filter((q) => q.status === "APPROVED").length,
    pending: myQuestions.filter((q) => q.status === "PENDING" || q.status === "REVISION_SUBMITTED").length,
    revisionRequested: myQuestions.filter((q) => q.status === "REVISION_REQUESTED").length,
    rejected: myQuestions.filter((q) => q.status === "REJECTED").length,
    draft: myQuestions.filter((q) => q.status === "DRAFT").length,
  };

  const revisionQuestions = myQuestions.filter((q) => q.status === "REVISION_REQUESTED");

  const recentFeedback = myQuestions
    .filter((q) => q.moderationEvents.length > 0 && q.moderationEvents[0].note)
    .slice(0, 10);

  const statIcons: Array<React.ElementType> = [FileQuestion, CheckCircle2, Clock, RefreshCw, XCircle, FileEdit];

  const statItems = [
    { label: "Submitted", value: stats.submitted },
    { label: "Approved", value: stats.approved },
    { label: "Pending", value: stats.pending },
    { label: "Revision Requested", value: stats.revisionRequested },
    { label: "Rejected", value: stats.rejected },
    { label: "Draft", value: stats.draft },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contributor Dashboard"
        description="Contribute questions and track your submissions"
      />

      {/* Slot demand alert */}
      {banks.length > 0 && totalEmptySlots > 0 && (
        <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-[var(--warning)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--warning)]">
              {totalEmptySlots} slot{totalEmptySlots === 1 ? "" : "s"} need question{totalEmptySlots === 1 ? "" : "s"}{" "}
              in {banks.length} bank{banks.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link href="/dashboard/contributor/submit-question">
            <Button size="sm">Submit Question</Button>
          </Link>
        </div>
      )}

      {/* Revision requests section */}
      {revisionQuestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[var(--warning)]">
              <RefreshCw className="h-4 w-4" />
              Revision Needed ({revisionQuestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {revisionQuestions.map((q) => (
              <div
                key={q.id}
                className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{q.subjectVersion.subject.subjectName}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Module {q.moduleNumber} &middot; {q.marks} marks
                  </p>
                </div>
                <Link href={`/dashboard/contributor/questions/${q.id}/edit`}>
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bank cards */}
      {banks.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              title="No subjects assigned"
              description="You have not been assigned to any question banks. Contact your coordinator to get started."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {banksWithSlots.map((bank) => {
            const svId = bank.subject.versions[0]?.id;
            const filledCount = bank.slots.filter((s) => s.assignedQuestion).length;
            const totalSlots = bank.slots.length;
            const fillPercent = totalSlots > 0 ? Math.round((filledCount / totalSlots) * 100) : 0;
            const isHighestNeed = bank.emptySlotCount > 0 && bank.emptySlotCount === maxEmptySlots;

            return (
              <div key={bank.id} className="rounded-xl border border-[var(--border)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{bank.subject.subjectName}</p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {bank.subject.subjectCode} &middot; Sem {bank.examCycle.batchSemester.semesterNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        bank.phase === "COMPLETE"
                          ? "success"
                          : bank.phase === "DRAFTING"
                            ? "warning"
                            : "info"
                      }
                    >
                      {questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase}
                    </Badge>
                    {isHighestNeed && <Badge variant="danger">Highest Need</Badge>}
                  </div>
                </div>

                {/* Fill progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
                    <span>
                      {filledCount}/{totalSlots} slots filled
                    </span>
                    <span>{fillPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all"
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Link href={`/dashboard/contributor/submit-question?subjectVersionId=${svId ?? ""}`}>
                    <Button size="sm" variant="outline">
                      <PenSquare className="h-3.5 w-3.5" />
                      Submit Question
                    </Button>
                  </Link>
                  <Link href="/dashboard/contributor/my-subjects">
                    <Button size="sm" variant="ghost">
                      <Eye className="h-3.5 w-3.5" />
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats row */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {statItems.map((s, i) => {
          const Icon = statIcons[i] ?? FileQuestion;
          return <MetricTile key={s.label} icon={<Icon className="h-5 w-5" />} value={s.value} label={s.label} />;
        })}
      </div>

      {/* Recent feedback */}
      {recentFeedback.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentFeedback.map((q) => (
              <div key={q.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{q.subjectVersion.subject.subjectName}</p>
                  <Badge>{questionStatusLabels[q.status as keyof typeof questionStatusLabels] ?? q.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                  Module {q.moduleNumber} &middot; {q.marks} marks
                </p>
                {q.moderationEvents[0]?.note && (
                  <p className="mt-2 text-sm italic border-l-2 border-[var(--border)] pl-3 text-[var(--text-tertiary)]">
                    &ldquo;{q.moderationEvents[0].note}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bottom CTAs */}
      <div className="flex gap-3">
        <Link href="/dashboard/contributor/questions">
          <Button variant="outline">View My Questions</Button>
        </Link>
        <Link href="/dashboard/contributor/submit-question">
          <Button>Create New Question</Button>
        </Link>
      </div>
    </div>
  );
}
