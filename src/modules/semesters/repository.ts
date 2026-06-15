import { BaseRepository } from "@/modules/shared/base-repository";

export class SemesterRepository extends BaseRepository {
  list() {
    return this.prisma.semester.findMany({
      orderBy: [{ academicYearId: "asc" }, { number: "asc" }],
      include: { academicYear: true },
    });
  }

  findById(id: string) {
    return this.prisma.semester.findUnique({
      where: { id },
      include: { academicYear: true },
    });
  }

  findByAcademicYear(academicYearId: string) {
    return this.prisma.semester.findMany({
      where: { academicYearId },
      orderBy: { number: "asc" },
      include: { academicYear: true },
    });
  }

  create(data: { number: number; name: string; academicYearId: string }) {
    return this.prisma.semester.create({
      data,
      include: { academicYear: true },
    });
  }

  update(id: string, data: { number?: number; name?: string }) {
    return this.prisma.semester.update({
      where: { id },
      data,
      include: { academicYear: true },
    });
  }
}
