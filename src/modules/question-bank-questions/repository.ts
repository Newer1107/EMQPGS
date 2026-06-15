import { BaseRepository } from "@/modules/shared/base-repository";
import type { QuestionBankQuestionInput } from "@/modules/question-bank-questions/validation";

export class QuestionBankQuestionRepository extends BaseRepository {
  findByQuestionBank(questionBankId: string) {
    return this.prisma.questionBankQuestion.findMany({
      where: { questionBankId },
      include: {
        question: {
          include: {
            subjectVersion: { include: { subject: true } },
            creator: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { linkedAt: "desc" },
    });
  }

  findDuplicate(questionBankId: string, questionId: string) {
    return this.prisma.questionBankQuestion.findUnique({
      where: { questionBankId_questionId: { questionBankId, questionId } },
    });
  }

  create(data: QuestionBankQuestionInput) {
    return this.prisma.questionBankQuestion.create({
      data,
      include: { question: true },
    });
  }

  delete(id: string) {
    return this.prisma.questionBankQuestion.delete({ where: { id } });
  }
}
