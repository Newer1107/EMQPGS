import { BaseRepository } from "@/modules/shared/base-repository";
import type { AcademicUnitInput, AcademicUnitUpdateInput } from "@/modules/academic-units/validation";

export class AcademicUnitRepository extends BaseRepository {
  list() {
    return this.prisma.academicUnit.findMany({
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return this.prisma.academicUnit.findUnique({
      where: { id },
      include: {
        programmes: true,
        curriculumSubjects: { take: 5 },
      },
    });
  }

  findByCode(code: string) {
    return this.prisma.academicUnit.findUnique({ where: { code } });
  }

  create(data: AcademicUnitInput) {
    return this.prisma.academicUnit.create({ data });
  }

  update(id: string, data: AcademicUnitUpdateInput) {
    return this.prisma.academicUnit.update({ where: { id }, data });
  }

  async hasReferencedData(id: string): Promise<boolean> {
    const [programmes, subjects] = await Promise.all([
      this.prisma.programme.count({ where: { homeAcademicUnitId: id } }),
      this.prisma.curriculumSubject.count({ where: { academicUnitId: id } }),
    ]);
    return programmes > 0 || subjects > 0;
  }
}
