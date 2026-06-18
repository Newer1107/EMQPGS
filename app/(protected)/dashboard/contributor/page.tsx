import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { questionBankPhaseLabels, questionStatusLabels } from "@/lib/constants";

type BankWithSlots = {
  id: string;
  phase: string;
  subjectName: string;
  subjectCode: string;
  examType: string;
  examCycleLabel: string;
  totalSlots: number;
  slots: Array<{ moduleNumber: number; marks: number; assignedQuestion: { status: string } | null }>;
};

type ModuleMarksSummary = {
  moduleNumber: number;
  marks: number;
  filled: number;
  total: number;
  empty: number;
  biggest: boolean;
};

function computeModuleMarks(slots: BankWithSlots["slots"], totalModules: number, marksOptions: number[], slotsPerModule: number): ModuleMarksSummary[] {
  const result: ModuleMarksSummary[] = [];
  let maxEmpty = 0;

  for (let m = 1; m <= totalModules; m++) {
    for (const mk of marksOptions) {
      const group = slots.filter((s) => s.moduleNumber === m && s.marks === mk);
      const filled = group.filter((s) => s.assignedQuestion).length;
      const empty = slotsPerModule - filled;
      if (empty > maxEmpty) maxEmpty = empty;
      result.push({ moduleNumber: m, marks: mk, filled, total: slotsPerModule, empty, biggest: false });
    }
  }

  if (maxEmpty > 0) {
    for (const r of result) {
      if (r.empty === maxEmpty) r.biggest = true;
    }
  }

  return result;
}

export default async function ContributorDashboardPage() {
  const actor = await getCurrentUserFromCookies();

  const [banks, myQuestions] = await Promise.all([
    prisma.questionBank.findMany({
      where: actor.departmentId
        ? {
            subject: { departmentId: actor.departmentId },
            phase: { in: ["DRAFTING", "MODERATION"] },
          }
        : { phase: "DRAFTING" },
      include: {
        subject: true,
        examCycle: { include: { batchSemester: { include: { academicYear: true } } } },
        pattern: true,
        slots: {
          where: { assignedQuestionId: { not: null } },
          select: { moduleNumber: true, marks: true, assignedQuestion: { select: { status: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
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

  const stats = {
    submitted: myQuestions.filter((q) => q.status !== "DRAFT").length,
    approved: myQuestions.filter((q) => q.status === "APPROVED").length,
    pending: myQuestions.filter((q) => q.status === "PENDING" || q.status === "REVISION_SUBMITTED").length,
    revisionRequested: myQuestions.filter((q) => q.status === "REVISION_REQUESTED").length,
    rejected: myQuestions.filter((q) => q.status === "REJECTED").length,
    draft: myQuestions.filter((q) => q.status === "DRAFT").length,
  };

  const recentFeedback = myQuestions
    .filter((q) => q.moderationEvents.length > 0 && q.moderationEvents[0].note)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Contributor Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Contribute questions and track your submissions</p>
      </div>

      {banks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">My Banks ({banks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {banks.map((bank) => {
              const totalSlots = bank.pattern?.totalSlots ?? 126;
              const totalModules = bank.pattern?.totalModules ?? 6;
              const marksOptions = (bank.pattern?.marksPattern as number[]) ?? [2, 5, 10];
              const slotsPerModule = bank.pattern?.slotsPerModule ?? 7;
              const filledCount = bank.slots.length;
              const fillPct = totalSlots > 0 ? Math.round((filledCount / totalSlots) * 100) : 0;
              const summary = computeModuleMarks(bank.slots, totalModules, marksOptions, slotsPerModule);
              const biggestGap = summary.find((s) => s.biggest);

              return (
                <div key={bank.id} className="rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">{bank.subject.subjectName}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {bank.subject.subjectCode} · Sem {bank.examCycle.batchSemester.semesterNumber} · {bank.examCycle.batchSemester.academicYear.code} · {bank.examCycle.examType.replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase}</Badge>
                      <span className="text-sm font-medium">{fillPct}% filled</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {summary.map((sm) => (
                      <div key={`${sm.moduleNumber}-${sm.marks}`} className={`flex items-center gap-3 text-sm ${sm.biggest && sm.empty > 0 ? "font-medium" : ""}`}>
                        <span className="w-20 shrink-0 text-[var(--muted-foreground)]">Module {sm.moduleNumber}</span>
                        <span className="w-16 text-[var(--muted-foreground)]">{sm.marks} marks</span>
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">{sm.filled}</span>
                          <span className="text-[var(--muted-foreground)]">/</span>
                          <span className={sm.empty > 0 ? "text-red-600" : "text-[var(--muted-foreground)]"}>{sm.total}</span>
                          <span className="text-xs text-[var(--muted-foreground)] ml-1">
                            ({new Array(sm.total).fill(null).map((_, i) =>
                              i < sm.filled ? "■" : "□"
                            ).join("")})
                          </span>
                        </div>
                        {sm.biggest && sm.empty > 0 && (
                          <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">Gap</Badge>
                        )}
                      </div>
                    ))}
                  </div>

                  {biggestGap && biggestGap.empty > 0 && (
                    <div className="mt-3">
                      <Link
                        href={`/dashboard/contributor/submit-question?module=${biggestGap.moduleNumber}&marks=${biggestGap.marks}`}
                      >
                        <Button size="sm" variant="outline">
                          Create Question for Module {biggestGap.moduleNumber}, {biggestGap.marks} marks
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {banks.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-[var(--muted-foreground)]">
            No active banks found in your department.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">My Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <StatItem label="Submitted" value={stats.submitted} />
            <StatItem label="Approved" value={stats.approved} />
            <StatItem label="Pending" value={stats.pending} />
            <StatItem label="Revision Requested" value={stats.revisionRequested} />
            <StatItem label="Rejected" value={stats.rejected} />
            <StatItem label="Draft" value={stats.draft} />
          </div>
        </CardContent>
      </Card>

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
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Module {q.moduleNumber} · {q.marks} marks
                </p>
                {q.moderationEvents[0]?.note && (
                  <p className="mt-2 text-sm italic border-l-2 border-[var(--border)] pl-3">
                    {'\u201C'}{q.moderationEvents[0].note}{'\u201D'}
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

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{label}</p>
    </div>
  );
}


