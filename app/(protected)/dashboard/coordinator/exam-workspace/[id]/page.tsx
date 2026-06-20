import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { examTypeLabels } from "@/lib/constants";

const statusVariants: Record<string, "success" | "warning" | "default"> = {
  ACTIVE: "success",
  DRAFT: "warning",
  CLOSED: "default",
};

export default async function ExamWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const examCycle = await prisma.examCycle.findUnique({
    where: { id },
    include: {
      batchSemester: {
        include: {
          batch: { include: { department: true, curriculumScheme: true } },
          department: { select: { name: true } },
          academicYear: { select: { code: true } },
        },
      },
      subjectLinks: {
        include: { subject: { select: { id: true, subjectCode: true, subjectName: true, credits: true } } },
      },
    },
  });

  if (!examCycle) notFound();

  const bs = examCycle.batchSemester;
  const batch = bs?.batch;

  const banks = await prisma.questionBank.findMany({
    where: { batchSemesterId: bs?.id, subjectId: { in: examCycle.subjectLinks.map((l) => l.subjectId) } },
    select: { id: true, phase: true, recordStatus: true, subjectId: true },
  });
  const bankMap = new Map(banks.map((b) => [b.subjectId, b]));

  const completeBanks = banks.filter((b) => b.phase === "COMPLETE").length;
  const draftingBanks = banks.filter((b) => b.phase === "DRAFTING").length;
  const moderationBanks = banks.filter((b) => b.phase === "MODERATION").length;
  const approvalBanks = banks.filter((b) => b.phase === "APPROVAL").length;
  const lockedBanks = banks.filter((b) => b.recordStatus === "LOCKED").length;
  const noBanks = examCycle.subjectLinks.length - banks.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Link href="/dashboard/coordinator" className="hover:text-[var(--text-primary)] transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-[var(--text-primary)]">Exam Workspace</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {examTypeLabels[examCycle.examType as keyof typeof examTypeLabels] ?? examCycle.examType}
            <span className="text-[var(--text-tertiary)] font-normal"> &mdash; {batch?.name}</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Semester {bs?.semesterNumber} &middot; {bs?.academicYear?.code} &middot; {bs?.department?.name}
          </p>
        </div>
        <Badge variant={statusVariants[examCycle.status] ?? "default"} className="text-sm px-3 py-1">
          {examCycle.status}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Total Subjects</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{examCycle.subjectLinks.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Banks Created</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{banks.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Not Started</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{noBanks}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Completed</CardTitle></CardHeader>
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
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-tertiary)]">Banks Created</span>
                  <span className="font-medium">{banks.length}/{examCycle.subjectLinks.length}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${(banks.length / Math.max(examCycle.subjectLinks.length, 1)) * 100}%` }} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-tertiary)]">Banks Completed</span>
                  <span className="font-medium">{completeBanks}/{examCycle.subjectLinks.length}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${(completeBanks / Math.max(examCycle.subjectLinks.length, 1)) * 100}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Subjects ({examCycle.subjectLinks.length})</CardTitle>
                <div className="flex gap-1 text-xs text-[var(--text-tertiary)]">
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">{completeBanks} done</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">{draftingBanks} drafting</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">{moderationBanks + approvalBanks} wip</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[var(--border)]">
                {examCycle.subjectLinks.map((link) => {
                  const qb = bankMap.get(link.subjectId);
                  const status = qb ? { phase: qb.phase, recordStatus: qb.recordStatus } : null;
                  const statusText = status
                    ? status.recordStatus === "LOCKED" ? "Locked"
                      : status.phase === "COMPLETE" ? "Complete"
                      : status.phase === "APPROVAL" ? "In Approval"
                      : status.phase === "MODERATION" ? "In Moderation"
                      : status.phase === "DRAFTING" ? "Drafting"
                      : status.phase
                    : "Not Started";
                  const statusColor = status?.phase === "COMPLETE" ? "success" : status?.phase === "MODERATION" || status?.phase === "APPROVAL" ? "info" : status?.phase === "DRAFTING" ? "warning" : "default";
                  return (
                    <div key={link.subjectId} className="flex items-center gap-4 px-6 py-3 hover:bg-[var(--surface-hover)] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className="shrink-0">{link.subject.subjectCode}</Badge>
                          <span className="font-medium text-sm truncate">{link.subject.subjectName}</span>
                          <span className="text-xs text-[var(--text-tertiary)] shrink-0">{link.subject.credits} cr</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusColor as "success" | "warning" | "info" | "default"}>{statusText}</Badge>
                        {qb ? (
                          <Link href={`/dashboard/coordinator/question-banks/${qb.id}`}>
                            <Button variant="outline" size="sm">Open Bank</Button>
                          </Link>
                        ) : (
                          <span className="text-xs text-[var(--text-tertiary)]">No bank</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Academic Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Department</span><span className="font-medium text-right">{batch?.department?.name ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Batch</span><span className="font-medium">{batch?.name}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Semester</span><span className="font-medium">{bs?.semesterNumber}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Academic Year</span><span className="font-medium">{bs?.academicYear?.code}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Curriculum</span><span className="font-medium text-right">{batch?.curriculumScheme?.name}</span></div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Link href={batch ? `/dashboard/coe/batches/${batch.id}` : '#'}>
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
