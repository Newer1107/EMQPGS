import { BaseRepository } from "@/modules/shared/base-repository";

export class QuestionSlotRepository extends BaseRepository {
  findByQuestionBank(questionBankId: string) {
    return this.prisma.questionSlot.findMany({
      where: { questionBankId },
      include: {
        assignedQuestion: {
          include: {
            creator: { select: { id: true, name: true } },
            subjectVersion: { include: { subject: true } },
          },
        },
      },
      orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
    });
  }

  findById(id: string) {
    return this.prisma.questionSlot.findUnique({
      where: { id },
      include: {
        assignedQuestion: true,
        questionBank: { include: { subject: true } },
      },
    });
  }

  assignQuestion(id: string, questionId: string) {
    return this.prisma.questionSlot.update({
      where: { id, assignedQuestionId: null },
      data: { assignedQuestionId: questionId },
      include: { assignedQuestion: true },
    });
  }

  unassignQuestion(id: string) {
    return this.prisma.questionSlot.update({
      where: { id },
      data: { assignedQuestionId: null },
    });
  }
}
