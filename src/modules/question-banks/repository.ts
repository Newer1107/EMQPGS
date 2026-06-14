import { BaseRepository } from "@/modules/shared/base-repository";
import { QuestionBankInput } from "@/modules/question-banks/validation";

type WhereInput = { id: string; version?: number };

export class QuestionBankRepository extends BaseRepository {
  list() {
    return this.prisma.questionBank.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subject: true,
        examCycle: true,
        assignments: { include: { teacher: true } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.questionBank.findUnique({
      where: { id },
      include: {
        subject: true,
        examCycle: true,
        assignments: { include: { teacher: true } },
      },
    });
  }

  create(data: QuestionBankInput & { createdById: string }) {
    return this.prisma.questionBank.create({ data });
  }

  update(
    where: WhereInput,
    data: Partial<QuestionBankInput> & {
      lockedAt?: Date | null;
      version?: { increment: number };
    },
  ) {
    return this.prisma.questionBank.update({
      where,
      data,
    });
  }
}
