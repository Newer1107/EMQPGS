import { prisma } from "@/lib/db";
import type { AcademicUnitInput, AcademicUnitUpdateInput } from "@/modules/academic-units/validation";

export class AcademicUnitRepository {
  list() {
    return prisma.academicUnit.findMany({
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return prisma.academicUnit.findUnique({
      where: { id },
      include: {
        programmes: true,
        curriculumSubjects: { take: 5 },
      },
    });
  }

  findByCode(code: string) {
    return prisma.academicUnit.findUnique({ where: { code } });
  }

  create(data: AcademicUnitInput) {
    return prisma.academicUnit.create({ data });
  }

  update(id: string, data: AcademicUnitUpdateInput) {
    return prisma.academicUnit.update({ where: { id }, data });
  }

  async hasReferencedData(id: string): Promise<boolean> {
    const [programmes, subjects] = await Promise.all([
      prisma.programme.count({ where: { homeAcademicUnitId: id } }),
      prisma.curriculumSubject.count({ where: { academicUnitId: id } }),
    ]);
    return programmes > 0 || subjects > 0;
  }
}
