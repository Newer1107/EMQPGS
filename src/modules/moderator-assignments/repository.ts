import { prisma } from "@/lib/db";

export class ModeratorAssignmentRepository {
  findModeratorById(id: string) {
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

  findDuplicate(moderatorId: string, questionBankId: string) {
    return prisma.moderatorBankAssignment.findUnique({
      where: { moderatorId_questionBankId: { moderatorId, questionBankId } },
    });
  }

  create(moderatorId: string, questionBankId: string) {
    return prisma.moderatorBankAssignment.create({
      data: { moderatorId, questionBankId },
    });
  }
}
