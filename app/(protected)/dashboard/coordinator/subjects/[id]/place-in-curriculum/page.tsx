import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { PlacementForm } from "./placement-form";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function PlaceInCurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUserFromCookies();
  const deptUtils = new DepartmentAccessUtils();

  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      department: true,
      curriculumSubjects: {
        include: { curriculumScheme: { select: { id: true, name: true, year: true } } },
      },
    },
  });
  if (!subject) notFound();
  await deptUtils.assertDepartmentAccess(actor, subject.departmentId);

  const existingPlacements = subject.curriculumSubjects ?? [];

  const schemes = await prisma.curriculumScheme.findMany({
    where: { isActive: true },
    orderBy: [{ year: "desc" }, { name: "asc" }],
    include: { department: { select: { name: true } } },
  });

  const departments = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const semesters = Array.from({ length: 8 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Place Subject in Curriculum"
        description={`${subject.subjectCode} — ${subject.subjectName}`}
      />

      {existingPlacements.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          This subject is already placed in {existingPlacements.length} curriculum slot(s).
          Adding another placement will make it available in an additional semester or scheme.
        </div>
      )}

      <PlacementForm
        subjectId={id}
        schemes={schemes.map((s) => ({ id: s.id, label: `${s.name} (${s.year}) — ${s.department.name}` }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name, code: d.code }))}
        semesters={semesters}
      />
    </div>
  );
}
