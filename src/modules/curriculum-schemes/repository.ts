import { prisma } from "@/lib/db";
import type { CurriculumSchemeInput, CurriculumSchemeUpdateInput } from "@/modules/curriculum-schemes/validation";

export class CurriculumSchemeRepository {
  list() {
    return prisma.curriculumScheme.findMany({
      orderBy: [{ year: "desc" }, { name: "asc" }],
      include: { department: true },
    });
  }

  findByDepartment(departmentId: string) {
    return prisma.curriculumScheme.findMany({
      where: { departmentId },
      orderBy: { year: "desc" },
      include: { department: true, _count: { select: { curriculumSubjects: true, batches: true } } },
    });
  }

  findById(id: string) {
    return prisma.curriculumScheme.findUnique({
      where: { id },
      include: {
        department: true,
        curriculumSubjects: {
          include: { subject: true, department: true },
          orderBy: [{ semesterNumber: "asc" }, { subject: { subjectName: "asc" } }],
        },
      },
    });
  }

  findActiveByDepartment(departmentId: string) {
    return prisma.curriculumScheme.findFirst({
      where: { departmentId, isActive: true },
    });
  }

  create(data: CurriculumSchemeInput) {
    return prisma.curriculumScheme.create({
      data,
      include: { department: true },
    });
  }

  deactivateAllForDepartment(departmentId: string, excludeId?: string) {
    return prisma.curriculumScheme.updateMany({
      where: {
        departmentId,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isActive: false },
    });
  }

  update(id: string, data: CurriculumSchemeUpdateInput) {
    return prisma.curriculumScheme.update({
      where: { id },
      data,
      include: { department: true },
    });
  }

  async hasReferencedData(id: string): Promise<boolean> {
    const [subjects, batches] = await Promise.all([
      prisma.curriculumSubject.count({ where: { curriculumSchemeId: id } }),
      prisma.batch.count({ where: { curriculumSchemeId: id } }),
    ]);
    return subjects > 0 || batches > 0;
  }

  delete(id: string) {
    return prisma.curriculumScheme.delete({ where: { id } });
  }
}
