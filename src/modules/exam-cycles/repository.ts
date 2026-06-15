import { BaseRepository } from "@/modules/shared/base-repository";
import { ExamCycleInput } from "@/modules/exam-cycles/validation";

export class ExamCycleRepository extends BaseRepository {
  list() {
    return this.prisma.examCycle.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        department: true,
        academicYear: true,
        semester: true,
        questionBanks: true,
      },
    });
  }

  findById(id: string) {
    return this.prisma.examCycle.findUnique({
      where: { id },
      include: { academicYear: true, semester: true },
    });
  }

  create(data: ExamCycleInput) {
    return this.prisma.examCycle.create({ data });
  }

  update(id: string, data: Partial<ExamCycleInput>) {
    return this.prisma.examCycle.update({ where: { id }, data });
  }
}
