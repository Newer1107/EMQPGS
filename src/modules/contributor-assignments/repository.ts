import { prisma } from "@/lib/db";

const ACTIVE_FILTER = { deletedAt: null } as const;

export class ContributorAssignmentRepository {
  findQuestionBankById(id: string) {
    return prisma.questionBank.findUnique({
      where: { id },
      include: { subject: { select: { subjectName: true } } },
    });
  }

  findDuplicate(contributorId: string, questionBankId: string) {
    return prisma.responsibilityAssignment.findFirst({
      where: {
        userId: contributorId,
        responsibility: "CONTRIBUTOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
        ...ACTIVE_FILTER,
      },
    });
  }

  create(contributorId: string, questionBankId: string, assignedById: string) {
    return prisma.responsibilityAssignment.create({
      data: {
        userId: contributorId,
        responsibility: "CONTRIBUTOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
        assignedById,
      },
    });
  }

  delete(contributorId: string, questionBankId: string, deletedById: string, reason?: string) {
    return prisma.responsibilityAssignment.updateMany({
      where: {
        userId: contributorId,
        responsibility: "CONTRIBUTOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
        ...ACTIVE_FILTER,
      },
      data: { deletedAt: new Date(), deletedById, deletionReason: reason ?? null },
    });
  }

  listByBank(questionBankId: string) {
    return prisma.responsibilityAssignment.findMany({
      where: {
        responsibility: "CONTRIBUTOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
        ...ACTIVE_FILTER,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
