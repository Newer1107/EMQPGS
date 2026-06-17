import { BaseRepository } from "@/modules/shared/base-repository";
import type { BatchInput, BatchUpdateInput } from "@/modules/batches/validation";

export class BatchRepository extends BaseRepository {
  list() {
    return this.prisma.batch.findMany({
      orderBy: [{ admissionYear: "desc" }, { name: "asc" }],
      include: {
        programme: { include: { homeAcademicUnit: true } },
        curriculumScheme: true,
        _count: { select: { batchSemesters: true, teachingGroups: true } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.batch.findUnique({
      where: { id },
      include: {
        programme: { include: { homeAcademicUnit: true, firstYearAcademicUnit: true } },
        curriculumScheme: { include: { curriculumSubjects: true } },
        batchSemesters: { orderBy: { semesterNumber: "asc" } },
        teachingGroups: true,
      },
    });
  }

  findByCode(code: string) {
    return this.prisma.batch.findUnique({ where: { code } });
  }

  findByProgramme(programmeId: string) {
    return this.prisma.batch.findMany({
      where: { programmeId },
      orderBy: { admissionYear: "desc" },
      include: {
        programme: true,
        curriculumScheme: true,
        batchSemesters: { orderBy: { semesterNumber: "asc" } },
      },
    });
  }

  create(data: BatchInput) {
    return this.prisma.batch.create({
      data,
      include: {
        programme: { include: { homeAcademicUnit: true, firstYearAcademicUnit: true } },
        curriculumScheme: true,
      },
    });
  }

  update(id: string, data: BatchUpdateInput) {
    return this.prisma.batch.update({
      where: { id },
      data,
      include: {
        programme: true,
        curriculumScheme: true,
      },
    });
  }

  delete(id: string) {
    return this.prisma.batch.delete({ where: { id } });
  }
}
