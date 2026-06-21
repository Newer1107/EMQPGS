import { PageHeader } from "@/components/dashboard/page-header";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { AssignmentsClient } from "./assignments-client";
import type { ResponsibilityType } from "@prisma/client";

export default async function AssignmentsPage() {
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(actor.id, actor);
  const deptUtils = new DepartmentAccessUtils();
  const departmentIds = await deptUtils.getAssignedDepartmentIds(auth);

  const [banks, moderatorUsers, rawModeratorAssignments, contributorUsers, rawContributorAssignments] = await Promise.all([
    prisma.questionBank.findMany({
      orderBy: { createdAt: "desc" },
      where: { subject: { departmentId: { in: departmentIds } } },
      include: { subject: { select: { subjectCode: true, subjectName: true } }, batchSemester: { include: { academicYear: true } } },
      take: 100,
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.responsibilityAssignment.findMany({
      where: { responsibility: "MODERATOR" as ResponsibilityType, scopeType: "QUESTION_BANK" },
      include: { user: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.responsibilityAssignment.findMany({
      where: { responsibility: "CONTRIBUTOR" as ResponsibilityType, scopeType: "QUESTION_BANK" },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const bankLookup = new Map(banks.map((b) => [b.id, b]));

  const questionBanks = banks.map((b) => ({
    id: b.id,
    subject: b.subject,
    batchSemester: { semesterNumber: b.batchSemester.semesterNumber, academicYear: { code: b.batchSemester.academicYear.code } },
  }));

  const existingModeratorAssignments = rawModeratorAssignments
    .filter((a) => a.scopeId && bankLookup.has(a.scopeId))
    .map((a) => {
      const bank = bankLookup.get(a.scopeId!)!;
      return {
        id: a.id,
        questionBankId: a.scopeId!,
        moderatorId: a.userId,
        moderator: { name: a.user.name },
        questionBank: { subject: { subjectCode: bank.subject.subjectCode }, batchSemester: { semesterNumber: bank.batchSemester.semesterNumber } },
      };
    });

  const existingContributorAssignments = rawContributorAssignments
    .filter((a) => a.scopeId && bankLookup.has(a.scopeId))
    .map((a) => {
      const bank = bankLookup.get(a.scopeId!)!;
      return {
        id: a.id,
        questionBankId: a.scopeId!,
        contributorId: a.userId,
        contributor: { name: a.user.name },
        questionBank: { subject: { subjectCode: bank.subject.subjectCode }, batchSemester: { semesterNumber: bank.batchSemester.semesterNumber } },
      };
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description="Assign moderators and contributors to question banks."
      />
      <AssignmentsClient
        questionBanks={questionBanks}
        moderators={moderatorUsers}
        existingModeratorAssignments={existingModeratorAssignments}
        contributors={contributorUsers}
        existingContributorAssignments={existingContributorAssignments}
      />
    </div>
  );
}
