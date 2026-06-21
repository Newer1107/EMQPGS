import { prisma } from "@/lib/db";

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
      },
    });
  }

  create(moderatorId: string, questionBankId: string) {
    return prisma.responsibilityAssignment.create({
      data: {
        userId: moderatorId,
        responsibility: "MODERATOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
      },
    });
  }

  delete(moderatorId: string, questionBankId: string) {
    return prisma.responsibilityAssignment.deleteMany({
      where: {
        userId: moderatorId,
        responsibility: "MODERATOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
      },
    });
  }
}
