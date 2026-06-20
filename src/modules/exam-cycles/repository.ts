import { prisma } from "@/lib/db";
import type { ExamCycleInput } from "@/modules/exam-cycles/validation";

export class ExamCycleRepository {
  list(take = 50, skip = 0) {
    return prisma.examCycle.findMany({
      take: Math.min(take, 500),
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        batchSemester: {
          include: {
            batch: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
          },
        },
        questionBanks: { select: { id: true } },
      },
    });
  }

  findById(id: string) {
    return prisma.examCycle.findUnique({
      where: { id },
      include: {
        batchSemester: {
          include: {
            batch: { include: { department: true } },
            department: true,
          },
        },
        subjectLinks: { include: { subject: { select: { id: true, subjectCode: true, subjectName: true } } } },
      },
    });
  }

  findByBatch(batchId: string) {
    return prisma.examCycle.findMany({
      where: { batchSemester: { batchId } },
      orderBy: [{ batchSemester: { semesterNumber: "asc" } }, { examType: "asc" }],
      include: {
        batchSemester: {
          include: {
            batch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        _count: { select: { questionBanks: true, subjectLinks: true } },
      },
    });
  }

  create(data: ExamCycleInput) {
    return prisma.examCycle.create({ data });
  }

  update(id: string, data: Partial<ExamCycleInput>) {
    return prisma.examCycle.update({ where: { id }, data });
  }
}
