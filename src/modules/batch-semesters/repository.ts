import { BaseRepository } from "@/modules/shared/base-repository";
import type { BatchSemesterUpdateInput } from "@/modules/batch-semesters/validation";

export class BatchSemesterRepository extends BaseRepository {
  findById(id: string) {
    return this.prisma.batchSemester.findUnique({
      where: { id },
      include: { batch: true, academicYear: true, academicUnit: true },
    });
  }

  findByBatch(batchId: string) {
    return this.prisma.batchSemester.findMany({
      where: { batchId },
      orderBy: { semesterNumber: "asc" },
      include: { academicYear: true, academicUnit: true },
    });
  }

  findByBatchAndNumber(batchId: string, semesterNumber: number) {
    return this.prisma.batchSemester.findUnique({
      where: { batchId_semesterNumber: { batchId, semesterNumber } },
      include: { batch: true, academicYear: true, academicUnit: true },
    });
  }

  findActiveByAcademicUnit(academicUnitId: string) {
    return this.prisma.batchSemester.findMany({
      where: { academicUnitId, status: "ACTIVE" },
      include: { batch: { include: { programme: true } } },
      orderBy: [{ semesterNumber: "asc" }],
    });
  }

  findFirst(batchId: string) {
    return this.prisma.batchSemester.findFirst({
      where: { batchId },
      orderBy: { semesterNumber: "asc" },
      include: { batch: true, academicYear: true, academicUnit: true },
    });
  }

  findLast(batchId: string) {
    return this.prisma.batchSemester.findFirst({
      where: { batchId },
      orderBy: { semesterNumber: "desc" },
      include: { batch: true, academicYear: true, academicUnit: true },
    });
  }

  update(id: string, data: BatchSemesterUpdateInput) {
    return this.prisma.batchSemester.update({
      where: { id },
      data,
      include: { batch: true, academicYear: true, academicUnit: true },
    });
  }
}
