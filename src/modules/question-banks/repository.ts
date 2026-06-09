import { BaseRepository } from "@/modules/shared/base-repository";
import { QuestionBankInput } from "@/modules/question-banks/validation";

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

  update(id: string, data: Partial<QuestionBankInput> & { lockedAt?: Date | null }) {
    return this.prisma.questionBank.update({ where: { id }, data });
  }
}
