import { getCurrentUserFromCookies } from "@/lib/api-context";
import { prisma } from "@/lib/db";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { CoverageDashboardClient } from "./coverage-client";

export default async function CoveragePage() {
  const actor = await getCurrentUserFromCookies();
  const deptUtils = new DepartmentAccessUtils();
  const departmentIds = await deptUtils.getAssignedDepartmentIds(actor);

  const [academicYears, subjects, subjectVersions, questionBanks] = await Promise.all([
    prisma.academicYear.findMany({ orderBy: { startDate: "desc" }, select: { id: true, code: true } }),
    prisma.subject.findMany({
      where: { departmentId: { in: departmentIds }, status: "ACTIVE" },
      orderBy: { subjectName: "asc" },
      select: { id: true, subjectCode: true, subjectName: true },
    }),
    prisma.subjectVersion.findMany({
      where: { subject: { departmentId: { in: departmentIds } }, status: "ACTIVE" },
      orderBy: { versionNumber: "desc" },
      select: { id: true, versionNumber: true, title: true, subjectId: true, effectiveFromAcademicYearId: true },
    }),
    prisma.questionBank.findMany({
      where: { subject: { departmentId: { in: departmentIds } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, subjectId: true, examCycleId: true, phase: true, recordStatus: true },
    }),
  ]);

  return (
    <CoverageDashboardClient
      academicYears={academicYears}
      semesters={[]}
      subjects={subjects}
      subjectVersions={subjectVersions}
      questionBanks={questionBanks}
    />
  );
}
