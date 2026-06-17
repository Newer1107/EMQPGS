import { BaseRepository } from "@/modules/shared/base-repository";
import type { ProgrammeInput, ProgrammeUpdateInput } from "@/modules/programmes/validation";

export class ProgrammeRepository extends BaseRepository {
  list() {
    return this.prisma.programme.findMany({
      orderBy: { name: "asc" },
      include: { homeAcademicUnit: true, firstYearAcademicUnit: true },
    });
  }

  findById(id: string) {
    return this.prisma.programme.findUnique({
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
    return this.prisma.programme.findUnique({ where: { code } });
  }

  create(data: ProgrammeInput) {
    return this.prisma.programme.create({ data, include: { homeAcademicUnit: true, firstYearAcademicUnit: true } });
  }

  update(id: string, data: ProgrammeUpdateInput) {
    return this.prisma.programme.update({ where: { id }, data, include: { homeAcademicUnit: true, firstYearAcademicUnit: true } });
  }

  async hasReferencedData(id: string): Promise<boolean> {
    const [schemes, batches] = await Promise.all([
      this.prisma.curriculumScheme.count({ where: { programmeId: id } }),
      this.prisma.batch.count({ where: { programmeId: id } }),
    ]);
    return schemes > 0 || batches > 0;
  }
}
