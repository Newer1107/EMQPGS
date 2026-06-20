import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EntityStatusBanner } from "@/components/shared/entity-status-banner";
import { examTypeLabels, examCycleStatusLabels } from "@/lib/constants";

export const metadata: Metadata = { title: "Exam Cycle — EMQPGS" };

const statusVariants: Record<string, "success" | "warning" | "default"> = { ACTIVE: "success", DRAFT: "warning", CLOSED: "default" };

export default async function ExamCycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cycle = await prisma.examCycle.findUnique({
    where: { id },
    include: {
      batchSemester: {
        include: {
          batch: { include: { department: true, curriculumScheme: true } },
          department: { select: { name: true, code: true } },
          academicYear: { select: { code: true } },
        },
      },
      subjectLinks: {
        include: { subject: { select: { id: true, subjectCode: true, subjectName: true, credits: true } } },
      },
      questionBanks: {
        select: { id: true, phase: true },
      },
    },
  });
  if (!cycle) notFound();

  const bs = cycle.batchSemester;
  const batch = bs?.batch;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${examTypeLabels[cycle.examType as keyof typeof examTypeLabels] ?? cycle.examType} — ${batch?.name ?? ''}`}
        description={`Semester ${bs?.semesterNumber} · ${bs?.academicYear?.code ?? ''} · ${bs?.department?.name ?? ''}`}
      />

      {cycle.questionBanks.length === 0 && (
        <EntityStatusBanner
          items={[{
            id: "no-banks",
            title: "No Question Banks Initialized",
            description: "This exam cycle has no question banks initialized. Question banks must be created in the Coordinator workspace before this cycle can proceed.",
            severity: "critical",
          }]}
        />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Academic Information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Department</span><span className="font-medium">{batch?.department?.name ?? '-'}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Batch</span><span className="font-medium">{batch?.name}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Semester</span><span className="font-medium">Semester {bs?.semesterNumber}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Academic Year</span><span className="font-medium">{bs?.academicYear?.code}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Curriculum</span><span className="font-medium">{batch?.curriculumScheme?.name} ({batch?.curriculumScheme?.year})</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Exam Information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Exam Type</span><Badge variant="info">{examTypeLabels[cycle.examType as keyof typeof examTypeLabels] ?? cycle.examType}</Badge></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Status</span><Badge variant={statusVariants[cycle.status] ?? "default"}>{examCycleStatusLabels[cycle.status as keyof typeof examCycleStatusLabels] ?? cycle.status}</Badge></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Subjects</span><Badge>{cycle.subjectLinks.length} subjects</Badge></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Question Banks</span><Badge>{cycle.questionBanks.length} banks</Badge></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Created</span><span>{new Date(cycle.createdAt).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Version</span><span>{cycle.version}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Subjects ({cycle.subjectLinks.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[var(--border)]">
            {cycle.subjectLinks.map((link) => (
              <div key={link.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium">{link.subject.subjectName}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{link.subject.subjectCode} · {link.subject.credits} credits</p>
                </div>
                <Badge variant="default">{link.subject.subjectCode}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {cycle.questionBanks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Question Banks ({cycle.questionBanks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cycle.questionBanks.map((qb) => (
                <Link key={qb.id} href={`/dashboard/coordinator/question-banks/${qb.id}`} className="rounded-lg border border-[var(--border)] p-3 text-sm hover:bg-[var(--surface-hover)] transition-colors">
                  <p className="font-medium">{qb.phase}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Question Bank</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <Link href={`/dashboard/coe/batches/${batch?.id}`} className="text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline transition-colors">
          View Batch
        </Link>
        <Link href="/dashboard/coe/exam-cycles" className="text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline transition-colors">
          All Exam Cycles
        </Link>
      </div>
    </div>
  );
}
