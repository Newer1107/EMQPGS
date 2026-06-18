import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { ensureQuestionBankMutable } from "@/modules/question-banks/mutable-guard";
import { QuestionSlotRepository } from "@/modules/question-slots/repository";

type Actor = { id: string; role: string };

export class QuestionSlotService {
  constructor(
    private readonly repository = new QuestionSlotRepository(),
  ) {}

  async list(questionBankId: string) {
    return this.repository.findByQuestionBank(questionBankId);
  }

  async assignToSlot(slotId: string, questionId: string, actor: Actor) {
    const slot = await this.repository.findById(slotId);
    if (!slot) throw new NotFoundError("Slot not found");

    const bank = await prisma.questionBank.findUnique({ where: { id: slot.questionBankId } });
    if (!bank) throw new NotFoundError("Question bank not found");
    ensureQuestionBankMutable(bank.recordStatus);

    if (actor.role !== "COORDINATOR") {
      const assignment = await prisma.contributorBankAssignment.findUnique({
        where: { contributorId_questionBankId: { contributorId: actor.id, questionBankId: slot.questionBankId } },
      });
      if (!assignment) {
        throw new AppError("You are no longer assigned to contribute to this question bank.", 403);
      }
    }

    if (slot.isLocked) {
      throw new AppError("Slot is locked and cannot be modified.", 409);
    }

    const question = await prisma.questionLibraryItem.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundError("Question not found");

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

  async unassignFromSlot(slotId: string, actor: Actor) {
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
