import { prisma } from "@/lib/db";

export class ContributorAssignmentRepository {
  findContributorById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, name: true, email: true },
    });
  }

  findQuestionBankById(id: string) {
    return prisma.questionBank.findUnique({
      where: { id },
      include: { subject: { select: { subjectName: true } } },
    });
  }

  findDuplicate(contributorId: string, questionBankId: string) {
    return prisma.contributorBankAssignment.findUnique({
      where: { contributorId_questionBankId: { contributorId, questionBankId } },
    });
  }

  create(contributorId: string, questionBankId: string) {
    return prisma.contributorBankAssignment.create({
      data: { contributorId, questionBankId },
    });
  }

  delete(contributorId: string, questionBankId: string) {
    return prisma.contributorBankAssignment.delete({
      where: { contributorId_questionBankId: { contributorId, questionBankId } },
    });
  }

  listByBank(questionBankId: string) {
    return prisma.contributorBankAssignment.findMany({
      where: { questionBankId },
      include: {
        contributor: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
