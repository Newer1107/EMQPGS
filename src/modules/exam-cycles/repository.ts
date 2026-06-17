import { BaseRepository } from "@/modules/shared/base-repository";
import type { ExamCycleInput } from "@/modules/exam-cycles/validation";

export class ExamCycleRepository extends BaseRepository {
  list(take = 50, skip = 0) {
    return this.prisma.examCycle.findMany({
      take: Math.min(take, 500),
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        department: true,
        academicYear: true,
        semester: true,
        batchSemester: {
          include: {
            batch: { select: { id: true, name: true, code: true } },
            academicUnit: { select: { id: true, name: true, code: true } },
          },
        },
        questionBanks: { select: { id: true } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.examCycle.findUnique({
      where: { id },
      include: {
        academicYear: true,
        semester: true,
        batchSemester: {
          include: {
            batch: { include: { programme: true } },
            academicUnit: true,
          },
        },
        subjectLinks: { include: { subject: { select: { id: true, subjectCode: true, subjectName: true } } } },
      },
    });
  }

  findByBatch(batchId: string) {
    return this.prisma.examCycle.findMany({
      where: { batchSemester: { batchId } },
      orderBy: [{ batchSemester: { semesterNumber: "asc" } }, { examType: "asc" }],
      include: {
        batchSemester: {
          include: {
            batch: { select: { id: true, name: true } },
            academicUnit: { select: { id: true, name: true } },
          },
        },
        _count: { select: { questionBanks: true, subjectLinks: true } },
      },
    });
  }

  create(data: ExamCycleInput) {
    return this.prisma.examCycle.create({ data });
  }

  update(id: string, data: Partial<ExamCycleInput>) {
    return this.prisma.examCycle.update({ where: { id }, data });
  }
}
