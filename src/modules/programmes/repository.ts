import { prisma } from "@/lib/db";
import type { ProgrammeInput, ProgrammeUpdateInput } from "@/modules/programmes/validation";

export class ProgrammeRepository {
  list() {
    return prisma.programme.findMany({
      orderBy: { name: "asc" },
      include: { homeAcademicUnit: true, firstYearAcademicUnit: true },
    });
  }

  findById(id: string) {
    return prisma.programme.findUnique({
      where: { id },
      include: {
        homeAcademicUnit: true,
        firstYearAcademicUnit: true,
        curriculumSchemes: { where: { isActive: true }, take: 1 },
        batches: { take: 5, orderBy: { createdAt: "desc" } },
      },
    });
  }

  findByCode(code: string) {
    return prisma.programme.findUnique({ where: { code } });
  }

  create(data: ProgrammeInput) {
    return prisma.programme.create({ data, include: { homeAcademicUnit: true, firstYearAcademicUnit: true } });
  }

  update(id: string, data: ProgrammeUpdateInput) {
    return prisma.programme.update({ where: { id }, data, include: { homeAcademicUnit: true, firstYearAcademicUnit: true } });
  }

  async hasReferencedData(id: string): Promise<boolean> {
    const [schemes, batches] = await Promise.all([
      prisma.curriculumScheme.count({ where: { programmeId: id } }),
      prisma.batch.count({ where: { programmeId: id } }),
    ]);
    return schemes > 0 || batches > 0;
  }
}
