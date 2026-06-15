import { QuestionBankQuestionRepository } from "@/modules/question-bank-questions/repository";
import type { QuestionBankQuestionInput } from "@/modules/question-bank-questions/validation";
import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db";

export class QuestionBankQuestionService {
  constructor(private readonly repository = new QuestionBankQuestionRepository()) {}

  list(questionBankId: string) {
    if (!questionBankId) return [];
    return this.repository.findByQuestionBank(questionBankId);
  }

  async create(data: QuestionBankQuestionInput) {
    const bank = await prisma.questionBank.findUnique({ where: { id: data.questionBankId } });
    if (!bank) throw new NotFoundError("Question bank not found");

    const question = await prisma.questionLibraryItem.findUnique({ where: { id: data.questionId } });
    if (!question) throw new NotFoundError("Question not found");

    const existing = await this.repository.findDuplicate(data.questionBankId, data.questionId);
    if (existing) throw new AppError("Question is already linked to this bank.", 409);

    return this.repository.create(data);
  }
}
