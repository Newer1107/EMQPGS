import { SemesterType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError, AppError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { AcademicYearRepository } from "@/modules/academic-years/repository";
import type { AcademicYearInput } from "@/modules/academic-years/validation";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;

function buildSemesterData(academicYearId: string) {
  return Array.from({ length: 8 }, (_, i) => ({
    number: i + 1,
    name: `Semester ${ROMAN[i]}`,
    academicYearId,
  }));
}

export class AcademicYearService {
  constructor(private readonly repository = new AcademicYearRepository()) {}

  list() {
    return this.repository.list();
  }

  async create(data: AcademicYearInput) {
    if (data.endDate <= data.startDate) {
      throw new AppError("End date must be after start date", 400);
    }
    return withUniqueCheck(
      () =>
        prisma.$transaction(async (tx) => {
          const year = await tx.academicYear.create({
            data: {
              code: data.code,
              startDate: data.startDate,
              endDate: data.endDate,
              status: data.status ?? "ACTIVE",
              activeSemesterType: data.activeSemesterType ?? SemesterType.ODD,
            },
          });
          await tx.semester.createMany({
            data: buildSemesterData(year.id),
          });
          return tx.academicYear.findUnique({
            where: { id: year.id },
            include: { semesters: { orderBy: { number: "asc" } } },
          })!;
        }),
      "AcademicYear_code_key",
    );
  }

  async update(id: string, data: Partial<AcademicYearInput>) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Academic year not found");
    return this.repository.update(id, data as any);
  }

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Academic year not found");
    return entity;
  }

  async findCurrent() {
    const now = new Date();
    return prisma.academicYear.findFirst({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        status: "ACTIVE",
      },
      include: { semesters: true },
    });
  }
}
