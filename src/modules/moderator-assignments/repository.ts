import { prisma } from "@/lib/db";

const ACTIVE_FILTER = { deletedAt: null } as const;

export class ModeratorAssignmentRepository {
  findQuestionBankById(id: string) {
    return prisma.questionBank.findUnique({
      where: { id },
      include: { subject: { select: { subjectName: true } } },
    });
  }

  findDuplicate(moderatorId: string, questionBankId: string) {
    return prisma.responsibilityAssignment.findFirst({
      where: {
        userId: moderatorId,
        responsibility: "MODERATOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
        ...ACTIVE_FILTER,
      },
    });
  }

  create(moderatorId: string, questionBankId: string, assignedById: string) {
    return prisma.responsibilityAssignment.create({
      data: {
        userId: moderatorId,
        responsibility: "MODERATOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
        assignedById,
      },
    });
  }

  delete(moderatorId: string, questionBankId: string, deletedById: string, reason?: string) {
    return prisma.responsibilityAssignment.updateMany({
      where: {
        userId: moderatorId,
        responsibility: "MODERATOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
        ...ACTIVE_FILTER,
      },
      data: { deletedAt: new Date(), deletedById, deletionReason: reason ?? null },
    });
  }
}
