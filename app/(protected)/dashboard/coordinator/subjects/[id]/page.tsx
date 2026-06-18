import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkCycleForm } from "@/components/forms/link-cycle-form";
import { ActionButton } from "@/components/forms/action-button";
import { ExamCycleStatus } from "@prisma/client";

export default async function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUserFromCookies();
  const deptUtils = new DepartmentAccessUtils();

  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      department: true,
      versions: { orderBy: { versionNumber: "desc" }, include: { effectiveFromAcademicYear: true } },
      examCycleLinks: { include: { examCycle: { include: { batchSemester: { include: { academicYear: true } } } } } },
      questionBanks: { include: { examCycle: true } },
    },
  });
  if (!subject) notFound();

  await deptUtils.assertDepartmentAccess(actor, subject.departmentId);

  const rawCycles = await prisma.examCycle.findMany({
    where: { status: ExamCycleStatus.ACTIVE },
    include: { batchSemester: { include: { academicYear: true } } },
    orderBy: { createdAt: "desc" },
  });
  const examCycles = rawCycles.map((c) => ({
    id: c.id,
    examType: c.examType,
    semester: { name: `Semester ${c.batchSemester?.semesterNumber ?? ''}` },
    academicYear: { code: c.batchSemester?.academicYear?.code ?? '' },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{subject.subjectName}</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">{subject.subjectCode}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/coordinator/subjects/${id}/edit`}>
            <Button variant="outline" size="sm">Edit</Button>
          </Link>
          <Link href={`/dashboard/coordinator/subjects/${id}/versions`}>
            <Button variant="outline" size="sm">Versions</Button>
          </Link>
          <ActionButton
            label="Deactivate"
            endpoint={`/api/subjects/${id}/deactivate`}
            method="PATCH"
            confirmMessage="Deactivate this subject? Question banks can no longer be initialized."
            successMessage="Subject deactivated"
            onSuccess={() => {}}
            variant="danger"
            size="sm"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Subject Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Code</span><span>{subject.subjectCode}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Credits</span><span>{subject.credits}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Status</span><span>{subject.status}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Department</span><span>{subject.department?.name ?? '-'}</span></div>
          </CardContent>
        </Card>

        <LinkCycleForm subjectId={id} examCycles={examCycles} existingLinks={subject.examCycleLinks ?? []} />
      </div>

      <Card>
        <CardHeader><CardTitle>Linked Exam Cycles ({(subject.examCycleLinks ?? []).length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Exam Type</TH><TH>Semester</TH><TH>Academic Year</TH></TR></THead>
            <TBody>
              {(subject.examCycleLinks ?? []).map((link) => (
                <TR key={link.id}>
                  <TD>{link.examCycle.examType}</TD>
                  <TD>Sem {link.examCycle?.batchSemester?.semesterNumber ?? '-'}</TD>
                  <TD>{link.examCycle?.batchSemester?.academicYear?.code ?? '-'}</TD>
                </TR>
              ))}
              {subject.examCycleLinks?.length === 0 && (
                <TR><TD colSpan={3} className="text-center text-sm text-[var(--text-tertiary)]">No exam cycles linked</TD></TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
