import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { SubjectForm } from "@/components/forms/subject-form";

export default async function EditSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUserFromCookies();
  const deptUtils = new DepartmentAccessUtils();

  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { department: true, semester: true },
  });
  if (!subject) notFound();
  await deptUtils.assertDepartmentAccess(actor, subject.departmentId);

  const departmentIds = await deptUtils.getAssignedDepartmentIds(actor);
  const semesters = await prisma.semester.findMany({
    where: { academicYear: { status: "ACTIVE" } },
    include: { academicYear: true },
    orderBy: [{ academicYearId: "asc" }, { number: "asc" }],
  });
  const departments = await prisma.department.findMany({ where: { id: { in: departmentIds } }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Edit Subject</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{subject.subjectCode} - {subject.subjectName}</p>
      </div>
      <SubjectForm
        departments={departments}
        semesters={semesters}
        initialValues={{
          name: subject.subjectName,
          code: subject.subjectCode,
          departmentId: subject.departmentId,
          semesterId: subject.semesterId,
          credits: subject.credits,
        }}
        endpoint={`/api/subjects/${id}`}
        title="Update Subject"
      />
    </div>
  );
}
