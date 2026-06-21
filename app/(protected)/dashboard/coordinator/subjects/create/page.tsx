import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { SubjectForm } from "@/components/forms/subject-form";
import { prisma } from "@/lib/db";

export default async function CreateSubjectPage() {
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(actor.id, actor);
  const deptUtils = new DepartmentAccessUtils();
  const departmentIds = await deptUtils.getAssignedDepartmentIds(auth);
  const departments = await prisma.department.findMany({ where: { id: { in: departmentIds } }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create Subject</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">Create a new subject and initialize its first version.</p>
      </div>
      <SubjectForm departments={departments} endpoint="/api/subjects" title="Create Subject" />
    </div>
  );
}
