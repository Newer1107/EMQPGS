import { getCurrentUserFromCookies } from "@/lib/api-context";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { SubjectForm } from "@/components/forms/subject-form";
import { prisma } from "@/lib/db";

export default async function CreateSubjectPage() {
  const actor = await getCurrentUserFromCookies();
  const deptUtils = new DepartmentAccessUtils();
  const departmentIds = await deptUtils.getAssignedDepartmentIds(actor);
  const [departments, semesters] = await Promise.all([
    prisma.department.findMany({ where: { id: { in: departmentIds } }, orderBy: { name: "asc" } }),
    prisma.semester.findMany({
      where: { academicYear: { status: "ACTIVE" } },
      include: { academicYear: true },
      orderBy: [{ academicYearId: "asc" }, { number: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create Subject</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create a new subject and initialize its first version.</p>
      </div>
      <SubjectForm departments={departments} semesters={semesters} endpoint="/api/subjects" title="Create Subject" />
    </div>
  );
}
