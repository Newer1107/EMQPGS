import { prisma } from "@/lib/db";
import { QuestionBankInput } from "@/modules/question-banks/validation";

type WhereInput = { id: string; version?: number };

export class QuestionBankRepository {
  list() {
    return prisma.questionBank.findMany({
      orderBy: { createdAt: "desc" },
      include: { subject: true, examCycle: true },
    });
  }

  findById(id: string) {
    return prisma.questionBank.findUnique({
      where: { id },
      include: { subject: true, examCycle: true },
    });
  }

  create(data: QuestionBankInput & { createdById: string; phase?: import("@prisma/client").QuestionBankPhase; recordStatus?: import("@prisma/client").RecordStatus }) {
    return prisma.questionBank.create({ data });
  }

  update(
    where: WhereInput,
    data: Partial<{
      phase: import("@prisma/client").QuestionBankPhase;
      recordStatus: import("@prisma/client").RecordStatus;
      lockedAt: Date | null;
      lockedReason: string | null;
      version: { increment: number };
    }>,
  ) {
    return prisma.questionBank.update({ where, data });
  }
}
