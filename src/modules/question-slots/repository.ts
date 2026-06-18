import { prisma } from "@/lib/db";

export class QuestionSlotRepository {
  findByQuestionBank(questionBankId: string) {
    return prisma.questionSlot.findMany({
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
    return prisma.questionSlot.findUnique({
      where: { id },
      include: {
        assignedQuestion: true,
        questionBank: { include: { subject: true } },
      },
    });
  }

  assignQuestion(id: string, questionId: string) {
    return prisma.questionSlot.update({
      where: { id, assignedQuestionId: null },
      data: { assignedQuestionId: questionId },
      include: { assignedQuestion: true },
    });
  }

  unassignQuestion(id: string) {
    return prisma.questionSlot.update({
      where: { id },
      data: { assignedQuestionId: null },
    });
  }
}
