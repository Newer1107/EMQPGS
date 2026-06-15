import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ModeratorAssignmentForm } from "@/components/forms/moderator-assignment-form";

export default async function AssignmentsPage() {
  const actor = await getCurrentUserFromCookies();

  const [questionBanks, moderators, existingAssignments] = await Promise.all([
    prisma.questionBank.findMany({
      orderBy: { createdAt: "desc" },
      include: { subject: { select: { subjectCode: true, subjectName: true } }, examCycle: { include: { academicYear: true, semester: true } } },
      take: 100,
    }),
    prisma.user.findMany({
      where: { role: Role.MODERATOR, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.moderatorBankAssignment.findMany({
      include: { moderator: { select: { name: true } }, questionBank: { select: { subject: { select: { subjectCode: true } }, examCycle: { select: { examType: true } } } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Moderator Assignments</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Assign moderators to question banks for question review and approval.</p>
      </div>
      <ModeratorAssignmentForm
        questionBanks={questionBanks}
        moderators={moderators}
        existingAssignments={existingAssignments}
      />
    </div>
  );
}
