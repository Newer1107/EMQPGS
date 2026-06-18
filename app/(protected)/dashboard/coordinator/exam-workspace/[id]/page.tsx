import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressTimeline } from "@/components/coordinator/progress-timeline";
import { examTypeLabels } from "@/lib/constants";

export const metadata: Metadata = { title: "Exam Workspace — EMQPGS" };

const statusVariants: Record<string, "success" | "warning" | "default"> = {
  ACTIVE: "success",
  DRAFT: "warning",
  CLOSED: "default",
};

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className="font-medium">{value}/{max} ({pct}%)</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function getStatusForPhase(phase: string, recordStatus: string): string {
  if (recordStatus === "LOCKED") return "Locked";
  if (recordStatus === "ARCHIVED") return "Archived";
  switch (phase) {
    case "DRAFTING": return "Drafting";
    case "MODERATION": return "In Moderation";
    case "APPROVAL": return "In Approval";
    case "COMPLETE": return "Complete";
    default: return phase;
  }
}

export default async function ExamWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const examCycle = await prisma.examCycle.findUnique({
    where: { id },
    include: {
      batchSemester: {
        include: {
          batch: { include: { programme: true, curriculumScheme: true } },
          academicUnit: { select: { name: true } },
          academicYear: { select: { code: true } },
        },
      },
      subjectLinks: {
        include: {
          subject: {
            select: {
              id: true, subjectCode: true, subjectName: true, credits: true,
              questionBanks: {
                where: { examCycleId: id },
                select: { id: true, phase: true, recordStatus: true },
              },
              versions: {
                where: { status: "ACTIVE" },
                select: { id: true, versionNumber: true },
                take: 1,
              },
            },
          },
        },
      },
      _count: { select: { questionBanks: true } },
    },
  });

  if (!examCycle) notFound();

  const bs = examCycle.batchSemester;
  const batch = bs?.batch;
  const subjects = examCycle.subjectLinks.map((link) => link.subject);
  const totalSubjects = subjects.length;
  const initializedBanks = subjects.filter((s) => s.questionBanks.length > 0).length;
  const completeBanks = subjects.filter((s) => s.questionBanks.some((qb) => qb.phase === "COMPLETE")).length;
  const draftingBanks = subjects.filter((s) => s.questionBanks.some((qb) => qb.phase === "DRAFTING")).length;
  const moderationBanks = subjects.filter((s) => s.questionBanks.some((qb) => qb.phase === "MODERATION")).length;
  const approvalBanks = subjects.filter((s) => s.questionBanks.some((qb) => qb.phase === "APPROVAL")).length;
  const noBanks = subjects.filter((s) => s.questionBanks.length === 0).length;
  const lockedBanks = subjects.filter((s) => s.questionBanks.some((qb) => qb.recordStatus === "LOCKED")).length;

  const allBanks = subjects.flatMap((s) => s.questionBanks);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Link href="/dashboard/coordinator" className="hover:text-[var(--foreground)] transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-[var(--foreground)]">Exam Workspace</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {examTypeLabels[examCycle.examType as keyof typeof examTypeLabels] ?? examCycle.examType}
            <span className="text-[var(--muted-foreground)] font-normal"> — {batch?.name}</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Semester {bs?.semesterNumber} · {bs?.academicYear?.code} · {bs?.academicUnit?.name}
          </p>
        </div>
        <Badge variant={statusVariants[examCycle.status] ?? "default"} className="text-sm px-3 py-1">
          {examCycle.status}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Total Subjects</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalSubjects}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Banks Initialized</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{initializedBanks}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Not Started</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{noBanks}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Completed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{completeBanks}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Progress Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgressBar value={initializedBanks} max={totalSubjects} label="Banks Initialized" />
              <ProgressBar value={completeBanks} max={totalSubjects} label="Banks Completed" />
              <ProgressBar value={draftingBanks} max={totalSubjects} label="Currently Drafting" />
              <ProgressBar value={moderationBanks} max={totalSubjects} label="In Moderation" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Subjects ({totalSubjects})</CardTitle>
                <div className="flex gap-1 text-xs text-[var(--muted-foreground)]">
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">{completeBanks} done</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">{draftingBanks} drafting</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">{moderationBanks + approvalBanks} wip</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[var(--border)]">
                {subjects.length === 0 && (
                  <div className="px-6 py-8 text-center text-sm text-[var(--muted-foreground)]">
                    No subjects linked to this exam cycle yet.
                  </div>
                )}
                {subjects.map((subject) => {
                  const qb = subject.questionBanks[0];
                  const status = qb ? getStatusForPhase(qb.phase, qb.recordStatus) : "Not Started";
                  const statusColor = qb?.phase === "COMPLETE" ? "success" : qb?.phase === "MODERATION" || qb?.phase === "APPROVAL" ? "info" : qb?.phase === "DRAFTING" ? "warning" : "default";

                  return (
                    <div key={subject.id} className="flex items-center gap-4 px-6 py-3 hover:bg-[var(--muted)] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className="shrink-0">{subject.subjectCode}</Badge>
                          <span className="font-medium text-sm truncate">{subject.subjectName}</span>
                          <span className="text-xs text-[var(--muted-foreground)] shrink-0">{subject.credits} cr</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusColor as "success" | "warning" | "info" | "default"}>{status}</Badge>
                        {qb ? (
                          <Link href={`/dashboard/coordinator/question-banks/${qb.id}`}>
                            <Button variant="outline" size="sm">Open Bank</Button>
                          </Link>
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">No bank</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {allBanks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Work Queue</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const stalled = allBanks.filter((qb) => qb.phase !== "COMPLETE" && qb.recordStatus !== "LOCKED");
                  if (stalled.length === 0) {
                    return <p className="text-sm text-[var(--muted-foreground)]">All banks are on track.</p>;
                  }
                  return (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {noBanks > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="text-sm font-medium text-amber-800">Not Initialized</p>
                          <p className="text-xs text-amber-700 mt-1">{noBanks} subject{noBanks !== 1 ? 's' : ''} need question banks created.</p>
                        </div>
                      )}
                      {draftingBanks > 0 && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <p className="text-sm font-medium text-blue-800">In Drafting</p>
                          <p className="text-xs text-blue-700 mt-1">{draftingBanks} bank{draftingBanks !== 1 ? 's' : ''} awaiting questions.</p>
                        </div>
                      )}
                      {moderationBanks > 0 && (
                        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                          <p className="text-sm font-medium text-purple-800">Awaiting Moderation</p>
                          <p className="text-xs text-purple-700 mt-1">{moderationBanks} bank{moderationBanks !== 1 ? 's' : ''} ready for moderator review.</p>
                        </div>
                      )}
                      {approvalBanks > 0 && (
                        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                          <p className="text-sm font-medium text-indigo-800">Awaiting Approval</p>
                          <p className="text-xs text-indigo-700 mt-1">{approvalBanks} bank{approvalBanks !== 1 ? 's' : ''} ready for final approval.</p>
                        </div>
                      )}
                      {lockedBanks > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <p className="text-sm font-medium text-gray-800">Locked</p>
                          <p className="text-xs text-gray-700 mt-1">{lockedBanks} bank{lockedBanks !== 1 ? 's' : ''} finalized and locked.</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Academic Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Programme</span><span className="font-medium text-right">{batch?.programme?.name ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Batch</span><span className="font-medium">{batch?.name}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Semester</span><span className="font-medium">{bs?.semesterNumber}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Academic Unit</span><span className="font-medium">{bs?.academicUnit?.name}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Academic Year</span><span className="font-medium">{bs?.academicYear?.code}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Curriculum</span><span className="font-medium text-right">{batch?.curriculumScheme?.name}</span></div>
            </CardContent>
          </Card>

          <ProgressTimeline banks={allBanks} />

          <div className="space-y-2">
            <Link href={`/dashboard/coe/batches/${batch?.id}`}>
              <Button variant="outline" className="w-full justify-start text-sm">View Batch Details</Button>
            </Link>
            <Link href="/dashboard/coordinator/question-banks">
              <Button variant="outline" className="w-full justify-start text-sm">All Question Banks</Button>
            </Link>
            <Link href="/dashboard/coordinator/assignments">
              <Button variant="outline" className="w-full justify-start text-sm">Manage Assignments</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
