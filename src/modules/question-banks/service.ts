import { QuestionBankPhase, RecordStatus } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { withOptimisticLock, buildOptimisticUpdate, buildOptimisticWhere } from "@/lib/optimistic-lock";
import { QuestionBankRepository } from "@/modules/question-banks/repository";
import { QuestionBankInput } from "@/modules/question-banks/validation";
import { isValidPhaseTransition } from "@/modules/question-banks/transitions";
import { ReadinessEngine } from "@/modules/readiness/engine";
import { ensureQuestionBankMutable } from "@/modules/question-banks/mutable-guard";

export class QuestionBankService {
  constructor(
    private readonly repository = new QuestionBankRepository(),
    private readonly readinessEngine = new ReadinessEngine(),
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
    ensureQuestionBankMutable(entity.recordStatus);
    if (!isValidPhaseTransition(entity.phase, targetPhase)) {
      throw new AppError(`Cannot transition from ${entity.phase} to ${targetPhase}`, 409);
    }

    const readiness = await this.readinessEngine.isReady(id, targetPhase);
    if (!readiness.ready) {
      throw new AppError(
        `Phase advancement blocked: ${readiness.issues.join(" ")}`,
        409,
        "READINESS_BLOCKED",
        { issues: readiness.issues, warnings: readiness.warnings },
      );
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
