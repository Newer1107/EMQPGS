import { BaseRepository } from "@/modules/shared/base-repository";

export class AcademicYearRepository extends BaseRepository {
  list() {
    return this.prisma.academicYear.findMany({
      orderBy: { startDate: "desc" },
    });
  }

  findById(id: string) {
    return this.prisma.academicYear.findUnique({
      where: { id },
    });
  }

  findByCode(code: string) {
    return this.prisma.academicYear.findUnique({
      where: { code },
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
    });
  }

  update(id: string, data: Partial<{ code: string; startDate: Date; endDate: Date; status: import("@prisma/client").AcademicYearStatus }>) {
    return this.prisma.academicYear.update({
      where: { id },
      data,
    });
  }
}
