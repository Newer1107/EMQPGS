import { BaseRepository } from "@/modules/shared/base-repository";

export class ModeratorAssignmentRepository extends BaseRepository {
  findModeratorById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, name: true, email: true },
    });
  }

  findQuestionBankById(id: string) {
    return this.prisma.questionBank.findUnique({
      where: { id },
      include: { subject: { select: { subjectName: true } } },
    });
  }

  findDuplicate(moderatorId: string, questionBankId: string) {
    return this.prisma.moderatorBankAssignment.findUnique({
      where: { moderatorId_questionBankId: { moderatorId, questionBankId } },
    });
  }

  create(moderatorId: string, questionBankId: string) {
    return this.prisma.moderatorBankAssignment.create({
      data: { moderatorId, questionBankId },
    });
  }
}
