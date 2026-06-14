import { QuestionBankStatus } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { withOptimisticLock, buildOptimisticUpdate, buildOptimisticWhere } from "@/lib/optimistic-lock";
import { QuestionBankRepository } from "@/modules/question-banks/repository";
import { QuestionService } from "@/modules/questions/service";
import { QuestionBankInput } from "@/modules/question-banks/validation";
import { isValidTransition } from "@/modules/question-banks/transitions";

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
    if (!isValidTransition(entity.status, status)) {
      throw new AppError(`Cannot transition from ${entity.status} to ${status}`, 409);
    }
    return withOptimisticLock(
      () =>
        this.repository.update(
          buildOptimisticWhere(id, entity.version),
          buildOptimisticUpdate({
            status,
            lockedAt: status === QuestionBankStatus.LOCKED ? new Date() : undefined,
          }),
        ),
      "Question bank",
    );
  }
}
