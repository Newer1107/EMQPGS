import { prisma } from "@/lib/db";

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
      },
    });
  }

  create(contributorId: string, questionBankId: string) {
    return prisma.responsibilityAssignment.create({
      data: {
        userId: contributorId,
        responsibility: "CONTRIBUTOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
      },
    });
  }

  delete(contributorId: string, questionBankId: string) {
    return prisma.responsibilityAssignment.deleteMany({
      where: {
        userId: contributorId,
        responsibility: "CONTRIBUTOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
      },
    });
  }

  listByBank(questionBankId: string) {
    return prisma.responsibilityAssignment.findMany({
      where: {
        responsibility: "CONTRIBUTOR",
        scopeType: "QUESTION_BANK",
        scopeId: questionBankId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
