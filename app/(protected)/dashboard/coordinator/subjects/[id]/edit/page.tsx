import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { SubjectForm } from "@/components/forms/subject-form";

export default async function EditSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(actor.id, actor);
  const deptUtils = new DepartmentAccessUtils();

  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { department: true },
  });
  if (!subject) notFound();
  await deptUtils.assertDepartmentAccess(auth, subject.departmentId);

  const departmentIds = await deptUtils.getAssignedDepartmentIds(auth);
  const departments = await prisma.department.findMany({ where: { id: { in: departmentIds } }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Edit Subject</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">{subject.subjectCode} - {subject.subjectName}</p>
      </div>
      <SubjectForm
        departments={departments}
        initialValues={{
          name: subject.subjectName,
          code: subject.subjectCode,
          departmentId: subject.departmentId,

          credits: subject.credits,
        }}
        endpoint={`/api/subjects/${id}`}
        title="Update Subject"
      />
    </div>
  );
}
