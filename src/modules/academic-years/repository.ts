import { BaseRepository } from "@/modules/shared/base-repository";

export class AcademicYearRepository extends BaseRepository {
  list() {
    return this.prisma.academicYear.findMany({
      orderBy: { startDate: "desc" },
      include: { semesters: true },
    });
  }

  findById(id: string) {
    return this.prisma.academicYear.findUnique({
      where: { id },
      include: { semesters: true },
    });
  }

  findByCode(code: string) {
    return this.prisma.academicYear.findUnique({
      where: { code },
      include: { semesters: true },
    });
  }

  create(data: { code: string; startDate: Date; endDate: Date; status?: import("@prisma/client").AcademicYearStatus }) {
    return this.prisma.academicYear.create({
      data: {
        code: data.code,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status ?? "ACTIVE",
      },
      include: { semesters: true },
    });
  }

  update(id: string, data: Partial<{ code: string; startDate: Date; endDate: Date; status: import("@prisma/client").AcademicYearStatus }>) {
    return this.prisma.academicYear.update({
      where: { id },
      data,
      include: { semesters: true },
    });
  }
}
