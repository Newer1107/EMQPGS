import { QuestionBankStatus } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { QuestionBankRepository } from "@/modules/question-banks/repository";
import { QuestionService } from "@/modules/questions/service";
import { QuestionBankInput } from "@/modules/question-banks/validation";

export class QuestionBankService {
  constructor(
    private readonly repository = new QuestionBankRepository(),
    private readonly questionService = new QuestionService(),
  ) {}

  list() {
    return this.repository.list();
  }

  async create(data: QuestionBankInput & { createdById: string }) {
    const questionBank = await this.repository.create(data);
    await this.questionService.ensureSlotGrid(questionBank.id);
    return questionBank;
  }

  async updateStatus(id: string, status: QuestionBankStatus) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Question bank not found");
    return this.repository.update(id, {
      status,
      lockedAt: status === QuestionBankStatus.LOCKED ? new Date() : null,
    });
  }
}
