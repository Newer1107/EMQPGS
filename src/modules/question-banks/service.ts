import { QuestionBankPhase, RecordStatus } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { withOptimisticLock, buildOptimisticUpdate, buildOptimisticWhere } from "@/lib/optimistic-lock";
import { QuestionBankRepository } from "@/modules/question-banks/repository";
import { QuestionBankInput } from "@/modules/question-banks/validation";
import { isValidPhaseTransition } from "@/modules/question-banks/transitions";

export class QuestionBankService {
  constructor(
    private readonly repository = new QuestionBankRepository(),
  ) {}

  list() {
    return this.repository.list();
  }

  async create(data: QuestionBankInput & { createdById: string }) {
    return this.repository.create(data);
  }

  async advancePhase(id: string, targetPhase: QuestionBankPhase) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Question bank not found");
    if (!isValidPhaseTransition(entity.phase, targetPhase)) {
      throw new AppError(`Cannot transition from ${entity.phase} to ${targetPhase}`, 409);
    }
    return withOptimisticLock(
      () =>
        this.repository.update(
          buildOptimisticWhere(id, entity.version),
          buildOptimisticUpdate({ phase: targetPhase }),
        ),
      "Question bank",
    );
  }

  async lock(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Question bank not found");
    if (entity.recordStatus === RecordStatus.LOCKED) {
      throw new AppError("Question bank is already locked.", 409);
    }
    return withOptimisticLock(
      () =>
        this.repository.update(
          buildOptimisticWhere(id, entity.version),
          buildOptimisticUpdate({ recordStatus: RecordStatus.LOCKED, lockedAt: new Date() }),
        ),
      "Question bank",
    );
  }

  async unlock(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Question bank not found");
    return withOptimisticLock(
      () =>
        this.repository.update(
          buildOptimisticWhere(id, entity.version),
          buildOptimisticUpdate({ recordStatus: RecordStatus.ACTIVE, lockedAt: null }),
        ),
      "Question bank",
    );
  }
}
