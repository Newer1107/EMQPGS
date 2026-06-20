import { prisma } from "@/lib/db";

type WhereInput = { id: string; version?: number };

export class QuestionBankRepository {
  list() {
    return prisma.questionBank.findMany({
      orderBy: { createdAt: "desc" },
      include: { subject: true, batchSemester: { include: { academicYear: true } } },
    });
  }

  findById(id: string) {
    return prisma.questionBank.findUnique({
      where: { id },
      include: { subject: true, batchSemester: { include: { academicYear: true } } },
    });
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
