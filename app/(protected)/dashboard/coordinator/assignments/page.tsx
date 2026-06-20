import { Role } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { AssignmentsClient } from "./assignments-client";

export default async function AssignmentsPage() {
  const actor = await getCurrentUserFromCookies();
  const deptUtils = new DepartmentAccessUtils();
  const departmentIds = await deptUtils.getAssignedDepartmentIds(actor);

  const [banks, moderators, existingModeratorAssignments, contributors, existingContributorAssignments] = await Promise.all([
    prisma.questionBank.findMany({
      orderBy: { createdAt: "desc" },
      where: { subject: { departmentId: { in: departmentIds } } },
      include: { subject: { select: { subjectCode: true, subjectName: true } }, batchSemester: { include: { academicYear: true } } },
      take: 100,
    }),
    prisma.user.findMany({
      where: { role: Role.MODERATOR, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.moderatorBankAssignment.findMany({
      include: { moderator: { select: { name: true } }, questionBank: { select: { subject: { select: { subjectCode: true } }, batchSemester: { select: { semesterNumber: true } } } } },
    }),
    prisma.user.findMany({
      where: { role: Role.CONTRIBUTOR, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.contributorBankAssignment.findMany({
      include: { contributor: { select: { name: true } }, questionBank: { select: { subject: { select: { subjectCode: true } }, batchSemester: { select: { semesterNumber: true } } } } },
    }),
  ]);

  const questionBanks = banks.map((b) => ({
    id: b.id,
    subject: b.subject,
    batchSemester: { semesterNumber: b.batchSemester.semesterNumber, academicYear: { code: b.batchSemester.academicYear.code } },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description="Assign moderators and contributors to question banks."
      />
      <AssignmentsClient
        questionBanks={questionBanks}
        moderators={moderators}
        existingModeratorAssignments={existingModeratorAssignments}
        contributors={contributors}
        existingContributorAssignments={existingContributorAssignments}
      />
    </div>
  );
}
