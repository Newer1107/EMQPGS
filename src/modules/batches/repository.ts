import { prisma } from "@/lib/db";
import type { BatchInput, BatchUpdateInput } from "@/modules/batches/validation";

export class BatchRepository {
  list() {
    return prisma.batch.findMany({
      orderBy: [{ admissionYear: "desc" }, { name: "asc" }],
      include: {
        department: true,
        curriculumScheme: true,
        _count: { select: { batchSemesters: true, teachingGroups: true } },
      },
    });
  }

  findById(id: string) {
    return prisma.batch.findUnique({
      where: { id },
      include: {
        department: true,
        curriculumScheme: { include: { curriculumSubjects: true } },
        batchSemesters: { orderBy: { semesterNumber: "asc" } },
        teachingGroups: true,
      },
    });
  }

  findByCode(code: string) {
    return prisma.batch.findUnique({ where: { code } });
  }

  findByDepartment(departmentId: string) {
    return prisma.batch.findMany({
      where: { departmentId },
      orderBy: { admissionYear: "desc" },
      include: {
        department: true,
        curriculumScheme: true,
        batchSemesters: { orderBy: { semesterNumber: "asc" } },
      },
    });
  }

  create(data: BatchInput) {
    return prisma.batch.create({
      data,
      include: {
        department: true,
        curriculumScheme: true,
      },
    });
  }

  update(id: string, data: BatchUpdateInput) {
    return prisma.batch.update({
      where: { id },
      data,
      include: {
        department: true,
        curriculumScheme: true,
      },
    });
  }

  delete(id: string) {
    return prisma.batch.delete({ where: { id } });
  }
}
