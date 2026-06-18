import { QuestionBankPhase } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { withOptimisticLock, buildOptimisticUpdate, buildOptimisticWhere } from "@/lib/optimistic-lock";
import { QuestionBankRepository } from "@/modules/question-banks/repository";
import { isValidPhaseTransition } from "@/modules/question-banks/transitions";
import { ReadinessEngine } from "@/modules/readiness/engine";
import { ensureQuestionBankMutable } from "@/modules/question-banks/mutable-guard";

export class QuestionBankService {
  constructor(
    private readonly repository = new QuestionBankRepository(),
    private readonly readinessEngine = new ReadinessEngine(),
  ) {}

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
}
