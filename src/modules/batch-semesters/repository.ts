import { prisma } from "@/lib/db";
import type { BatchSemesterUpdateInput } from "@/modules/batch-semesters/validation";

export class BatchSemesterRepository {
  findById(id: string) {
    return prisma.batchSemester.findUnique({
      where: { id },
      include: { batch: true, academicYear: true, department: true },
    });
  }

  findByBatch(batchId: string) {
    return prisma.batchSemester.findMany({
      where: { batchId },
      orderBy: { semesterNumber: "asc" },
      include: { academicYear: true, department: true },
    });
  }

  findByBatchAndNumber(batchId: string, semesterNumber: number) {
    return prisma.batchSemester.findUnique({
      where: { batchId_semesterNumber: { batchId, semesterNumber } },
      include: { batch: true, academicYear: true, department: true },
    });
  }

  findActiveByDepartment(departmentId: string) {
    return prisma.batchSemester.findMany({
      where: { departmentId, status: "ACTIVE" },
      include: { batch: { include: { department: true } } },
      orderBy: [{ semesterNumber: "asc" }],
    });
  }

  findFirst(batchId: string) {
    return prisma.batchSemester.findFirst({
      where: { batchId },
      orderBy: { semesterNumber: "asc" },
      include: { batch: true, academicYear: true, department: true },
    });
  }

  findLast(batchId: string) {
    return prisma.batchSemester.findFirst({
      where: { batchId },
      orderBy: { semesterNumber: "desc" },
      include: { batch: true, academicYear: true, department: true },
    });
  }

  update(id: string, data: BatchSemesterUpdateInput) {
    return prisma.batchSemester.update({
      where: { id },
      data,
      include: { batch: true, academicYear: true, department: true },
    });
  }
}
