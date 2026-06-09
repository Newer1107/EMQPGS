import { Prisma, Role, type User } from "@prisma/client";
import { BaseRepository } from "@/modules/shared/base-repository";
import type { QuestionInput } from "@/modules/questions/validation";

const questionInclude = {
  contributor: true,
  attachments: {
    include: {
      fileAsset: true,
    },
  },
  slot: true,
  questionBank: {
    include: {
      subject: true,
      examCycle: true,
      assignments: { include: { teacher: true } },
    },
  },
} satisfies Prisma.QuestionInclude;

export class QuestionRepository extends BaseRepository {
  async listForQuestionBank(questionBankId: string, actor: Pick<User, "id" | "role">) {
    const where: Prisma.QuestionWhereInput = {
      questionBankId,
      ...(actor.role === Role.CONTRIBUTOR ? { contributorId: actor.id } : {}),
    };

    return this.prisma.question.findMany({
      where,
      orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
      include: questionInclude,
    });
  }

  async findById(id: string) {
    return this.prisma.question.findUnique({
      where: { id },
      include: questionInclude,
    });
  }

  async findSlotById(slotId: string) {
    return this.prisma.questionSlot.findUnique({
      where: { id: slotId },
      include: {
        reservedBy: true,
        question: true,
        questionBank: {
          include: {
            assignments: { include: { teacher: true } },
            subject: true,
          },
        },
      },
    });
  }

  async listSlots(questionBankId: string) {
    return this.prisma.questionSlot.findMany({
      where: { questionBankId },
      orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
      include: {
        reservedBy: true,
        question: {
          include: {
            contributor: true,
          },
        },
      },
    });
  }

  async reserveSlot(questionBankId: string, moduleNumber: number, marks: number, slotNumber: number, userId: string, moderatorOverride = false) {
    return this.prisma.$transaction(async (tx) => {
      const slot = await tx.questionSlot.findUnique({
        where: { questionBankId_moduleNumber_marks_slotNumber: { questionBankId, moduleNumber, marks, slotNumber } },
        include: { question: true },
      });

      if (!slot) return null;

      if (slot.question && !moderatorOverride) {
        return { slot, collision: "QUESTION_EXISTS" as const };
      }

      if (slot.reservedById && slot.reservedById !== userId && !moderatorOverride) {
        return { slot, collision: "SLOT_TAKEN" as const };
      }

      const updated = await tx.questionSlot.update({
        where: { id: slot.id },
        data: {
          reservedById: userId,
          reservedAt: new Date(),
          isLocked: true,
        },
      });

      return { slot: updated };
    });
  }

  async createQuestion(data: QuestionInput & { slotId: string; questionBankId: string; moduleNumber: number; marks: number; slotNumber: number; contributorId: string }) {
    return this.prisma.question.create({
      data,
      include: questionInclude,
    });
  }

  async updateQuestion(id: string, data: Prisma.QuestionUpdateInput) {
    return this.prisma.question.update({
      where: { id },
      data,
      include: questionInclude,
    });
  }

  async attachFile(questionId: string, fileAssetId: string, uploadedById: string) {
    return this.prisma.questionAttachment.create({
      data: { questionId, fileAssetId, uploadedById },
      include: {
        fileAsset: true,
      },
    });
  }

  async listAttachments(questionId: string) {
    return this.prisma.questionAttachment.findMany({
      where: { questionId },
      include: { fileAsset: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async replaceAttachment(id: string, fileAssetId: string) {
    return this.prisma.questionAttachment.update({
      where: { id },
      data: { fileAssetId },
      include: { fileAsset: true },
    });
  }

  async deleteAttachment(id: string) {
    return this.prisma.questionAttachment.delete({
      where: { id },
    });
  }

  async findAttachment(id: string) {
    return this.prisma.questionAttachment.findUnique({
      where: { id },
      include: {
        question: true,
        fileAsset: true,
      },
    });
  }
}
