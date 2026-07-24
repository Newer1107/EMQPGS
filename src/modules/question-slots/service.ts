import { Prisma, QuestionStatus, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { ensureQuestionBankMutable } from "@/modules/question-banks/mutable-guard";
import { QuestionSlotRepository } from "@/modules/question-slots/repository";

export class QuestionSlotService {
  constructor(
    private readonly repository = new QuestionSlotRepository(),
  ) {}

  async list(questionBankId: string) {
    return this.repository.findByQuestionBank(questionBankId);
  }

  async assignToSlot(slotId: string, questionId: string, ctx?: { userId: string }) {
    const slot = await this.repository.findById(slotId);
    if (!slot) throw new NotFoundError("Slot not found");

    const bank = await prisma.questionBank.findUnique({ where: { id: slot.questionBankId } });
    if (!bank) throw new NotFoundError("Question bank not found");
    ensureQuestionBankMutable(bank.recordStatus);

    if (slot.isLocked) {
      throw new AppError("Slot is locked and cannot be modified.", 409);
    }

    const question = await prisma.questionLibraryItem.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundError("Question not found");

    if (ctx?.userId) {
      const caller = await prisma.responsibilityAssignment.findFirst({
        where: { userId: ctx.userId, responsibility: "COORDINATOR" },
      });
      const isCoordinator = !!caller;
      if (!isCoordinator && question.ownerId !== ctx.userId) {
        throw new ForbiddenError("You can only assign your own questions to slots.");
      }
      if (!isCoordinator && question.status !== QuestionStatus.DRAFT && question.status !== QuestionStatus.REVISION_REQUESTED) {
        throw new AppError("Only draft or revision-requested questions can be assigned to slots.", 409);
      }
    }

    const duplicateInBank = await prisma.questionSlot.findFirst({
      where: {
        questionBankId: slot.questionBankId,
        assignedQuestionId: questionId,
        id: { not: slotId },
      },
    });
    if (duplicateInBank) {
      throw new AppError("This question is already assigned to another slot in the same bank.", 409);
    }

    return this.repository.assignQuestion(slotId, questionId).catch((err: unknown) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new ConflictError("This slot already has a question assigned.");
      }
      throw err;
    });
  }

  async unassignFromSlot(slotId: string) {
    const slot = await this.repository.findById(slotId);
    if (!slot) throw new NotFoundError("Slot not found");

    const bank = await prisma.questionBank.findUnique({ where: { id: slot.questionBankId } });
    if (!bank) throw new NotFoundError("Question bank not found");
    ensureQuestionBankMutable(bank.recordStatus);

    if (slot.isLocked) {
      throw new AppError("Slot is locked and cannot be modified.", 409);
    }

    return this.repository.unassignQuestion(slotId);
  }
}
