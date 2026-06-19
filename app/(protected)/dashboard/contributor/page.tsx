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
import { NextActions, PrimaryAction } from "@/components/dashboard/next-actions";
import { AttentionSection } from "@/components/dashboard/attention-card";
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

const OVERDUE_DAYS = 3;

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
  const now = Date.now();
  const overdueCount = revisionQuestions.filter(
    (q) => now - q.updatedAt.getTime() > OVERDUE_DAYS * 24 * 60 * 60 * 1000,
  ).length;

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

  // Highest-need bank for "Your Next Task"
  const sortedByNeed = [...banksWithSlots].sort((a, b) => b.emptySlotCount - a.emptySlotCount);
  const topNeededBank = sortedByNeed[0]?.emptySlotCount > 0 ? sortedByNeed[0] : null;
  const topSvid = topNeededBank?.subject.versions[0]?.id;

  // Attention items
  const attentionItems: Array<{ id: string; title: string; description: string; href: string; severity: "critical" | "warning" | "info" | "success" }> = [];
  if (overdueCount > 0) {
    attentionItems.push({
      id: "overdue-revisions",
      title: `${overdueCount} Overdue Revision${overdueCount > 1 ? "s" : ""}`,
      description: `Revision${overdueCount > 1 ? "s have" : " has"} been pending for over ${OVERDUE_DAYS} days. Please update and resubmit.`,
      href: "/dashboard/contributor/questions",
      severity: "critical",
    });
  }
  if (totalEmptySlots > 0) {
    attentionItems.push({
      id: "empty-slots",
      title: `${totalEmptySlots} Slot${totalEmptySlots > 1 ? "s" : ""} Need Question${totalEmptySlots > 1 ? "s" : ""}`,
      description: `Across ${banks.length} bank${banks.length > 1 ? "s" : ""}`,
      href: "/dashboard/contributor/submit-question",
      severity: "warning",
    });
  }

  // Next action: highest-need bank
  const nextActions = topNeededBank ? [
    {
      id: "next-bank",
      title: `${topNeededBank.subject.subjectName}`,
      description: `${topNeededBank.emptySlotCount} empty slot${topNeededBank.emptySlotCount > 1 ? "s" : ""} — highest need`,
      href: `/dashboard/contributor/submit-question?subjectVersionId=${topSvid ?? ""}`,
      priority: 1,
      severity: "warning" as const,
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* ZONE 1 */}
      <PageHeader
        title="Contributor Dashboard"
        description="Contribute questions and track your submissions"
      />

      {/* ZONE 2: What Needs My Attention */}
      <AttentionSection
        items={attentionItems}
        emptyMessage="No items need your attention right now."
        title="What Needs My Attention"
      />

      {/* ZONE 3: What Should I Do Next */}
      {nextActions.length > 0 && (
        <NextActions actions={nextActions} max={1} title="Your Next Task" />
      )}

      {/* Revision requests (attention for contributors) */}
      {revisionQuestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[var(--warning)]">
              <RefreshCw className="h-4 w-4" />
              Revision Needed ({revisionQuestions.length})
              {overdueCount > 0 && (
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  {overdueCount} overdue
                </span>
              )}
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
                    {now - q.updatedAt.getTime() > OVERDUE_DAYS * 24 * 60 * 60 * 1000 && (
                      <span className="ml-2 font-medium text-red-500">Overdue</span>
                    )}
                  </p>
                </div>
                <Link href={`/dashboard/contributor/questions/${q.id}/edit`}>
                  <Button size="sm" variant="outline">Edit</Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ZONE 4: Current Workload */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {statItems.map((s, i) => {
          const Icon = statIcons[i] ?? FileQuestion;
          return <MetricTile key={s.label} icon={<Icon className="h-5 w-5" />} value={s.value} label={s.label} />;
        })}
      </div>

      {/* ZONE 5: Everything Else — banks, feedback, CTAs */}
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
        <>
          {/* Slot demand alert — only if no attention section already covers it */}
          {attentionItems.length === 0 && totalEmptySlots > 0 && (
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

          {(() => {
            const remainingBanks = banksWithSlots.filter((b) => !topNeededBank || b.id !== topNeededBank.id);
            if (remainingBanks.length === 0) return null;
            return (
              <div className="grid gap-4 sm:grid-cols-2">
                {remainingBanks.map((bank) => {
                  const svId = bank.subject.versions[0]?.id;
                  const filledCount = bank.slots.filter((s) => s.assignedQuestion).length;
                  const totalSlots = bank.slots.length;
                  const fillPercent = totalSlots > 0 ? Math.round((filledCount / totalSlots) * 100) : 0;

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
                          <Badge variant={bank.phase === "COMPLETE" ? "success" : bank.phase === "DRAFTING" ? "warning" : "info"}>
                            {questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
                          <span>{filledCount}/{totalSlots} slots filled</span>
                          <span>{fillPercent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                          <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${fillPercent}%` }} />
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
            );
          })()}
        </>
      )}

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
