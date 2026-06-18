import { prisma } from "@/lib/db";

export class AcademicYearRepository {
  list() {
    return prisma.academicYear.findMany({
      orderBy: { startDate: "desc" },
    });
  }

  findById(id: string) {
    return prisma.academicYear.findUnique({
      where: { id },
    });
  }

  findByCode(code: string) {
    return prisma.academicYear.findUnique({
      where: { code },
    });
  }

  create(data: { code: string; startDate: Date; endDate: Date; status?: import("@prisma/client").AcademicYearStatus }) {
    return prisma.academicYear.create({
      data: {
        code: data.code,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status ?? "ACTIVE",
      },
    });
  }

  update(id: string, data: Partial<{ code: string; startDate: Date; endDate: Date; status: import("@prisma/client").AcademicYearStatus }>) {
    return prisma.academicYear.update({
      where: { id },
      data,
    });
  }
}
