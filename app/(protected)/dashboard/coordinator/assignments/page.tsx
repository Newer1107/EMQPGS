import { Role } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ModeratorAssignmentForm } from "@/components/forms/moderator-assignment-form";
import { ContributorAssignmentForm } from "@/components/forms/contributor-assignment-form";

export default async function AssignmentsPage() {
  const actor = await getCurrentUserFromCookies();

  const [banks, moderators, existingModeratorAssignments, contributors, existingContributorAssignments] = await Promise.all([
    prisma.questionBank.findMany({
      orderBy: { createdAt: "desc" },
      include: { subject: { select: { subjectCode: true, subjectName: true } }, examCycle: { include: { batchSemester: { include: { academicYear: true } } } } },
      take: 100,
    }),
    prisma.user.findMany({
      where: { role: Role.MODERATOR, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.moderatorBankAssignment.findMany({
      include: { moderator: { select: { name: true } }, questionBank: { select: { subject: { select: { subjectCode: true } }, examCycle: { select: { examType: true } } } } },
    }),
    prisma.user.findMany({
      where: { role: Role.CONTRIBUTOR, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.contributorBankAssignment.findMany({
      include: { contributor: { select: { name: true } }, questionBank: { select: { subject: { select: { subjectCode: true } }, examCycle: { select: { examType: true } } } } },
    }),
  ]);

  const questionBanks = banks.map((b) => ({
    ...b,
    examCycle: {
      ...b.examCycle,
      semester: { name: `Semester ${b.examCycle.batchSemester.semesterNumber}` },
      academicYear: { code: b.examCycle.batchSemester.academicYear.code },
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description="Assign moderators and contributors to question banks."
      />
      <ModeratorAssignmentForm
        questionBanks={questionBanks}
        moderators={moderators}
        existingAssignments={existingModeratorAssignments}
      />
      <ContributorAssignmentForm
        questionBanks={questionBanks}
        contributors={contributors}
        existingAssignments={existingContributorAssignments}
      />
    </div>
  );
}

