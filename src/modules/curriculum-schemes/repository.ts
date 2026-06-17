import { BaseRepository } from "@/modules/shared/base-repository";
import type { CurriculumSchemeInput, CurriculumSchemeUpdateInput } from "@/modules/curriculum-schemes/validation";

export class CurriculumSchemeRepository extends BaseRepository {
  list() {
    return this.prisma.curriculumScheme.findMany({
      orderBy: [{ year: "desc" }, { name: "asc" }],
      include: { programme: { include: { homeAcademicUnit: true } } },
    });
  }

  findByProgramme(programmeId: string) {
    return this.prisma.curriculumScheme.findMany({
      where: { programmeId },
      orderBy: { year: "desc" },
      include: { programme: true, _count: { select: { curriculumSubjects: true, batches: true } } },
    });
  }

  findById(id: string) {
    return this.prisma.curriculumScheme.findUnique({
      where: { id },
      include: {
        programme: { include: { homeAcademicUnit: true } },
        curriculumSubjects: {
          include: { subject: true, academicUnit: true },
          orderBy: [{ semesterNumber: "asc" }, { subject: { subjectName: "asc" } }],
        },
      },
    });
  }

  findActiveByProgramme(programmeId: string) {
    return this.prisma.curriculumScheme.findFirst({
      where: { programmeId, isActive: true },
    });
  }

  create(data: CurriculumSchemeInput) {
    return this.prisma.curriculumScheme.create({
      data,
      include: { programme: true },
    });
  }

  deactivateAllForProgramme(programmeId: string, excludeId?: string) {
    return this.prisma.curriculumScheme.updateMany({
      where: {
        programmeId,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isActive: false },
    });
  }

  update(id: string, data: CurriculumSchemeUpdateInput) {
    return this.prisma.curriculumScheme.update({
      where: { id },
      data,
      include: { programme: true },
    });
  }

  async hasReferencedData(id: string): Promise<boolean> {
    const [subjects, batches] = await Promise.all([
      this.prisma.curriculumSubject.count({ where: { curriculumSchemeId: id } }),
      this.prisma.batch.count({ where: { curriculumSchemeId: id } }),
    ]);
    return subjects > 0 || batches > 0;
  }

  delete(id: string) {
    return this.prisma.curriculumScheme.delete({ where: { id } });
  }
}
