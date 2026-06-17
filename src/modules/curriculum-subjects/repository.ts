import { BaseRepository } from "@/modules/shared/base-repository";
import { Prisma } from "@prisma/client";
import type { CurriculumSubjectInput, CurriculumSubjectUpdateInput } from "@/modules/curriculum-subjects/validation";

export class CurriculumSubjectRepository extends BaseRepository {
  list(where?: Prisma.CurriculumSubjectWhereInput) {
    return this.prisma.curriculumSubject.findMany({
      where,
      orderBy: [{ semesterNumber: "asc" }, { subject: { subjectName: "asc" } }],
      include: {
        curriculumScheme: { select: { id: true, name: true, year: true } },
        subject: { select: { id: true, subjectCode: true, subjectName: true, credits: true } },
        academicUnit: { select: { id: true, name: true, code: true } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.curriculumSubject.findUnique({
      where: { id },
      include: {
        curriculumScheme: { include: { programme: true } },
        subject: true,
        academicUnit: true,
      },
    });
  }

  findByScheme(schemeId: string) {
    return this.list({ curriculumSchemeId: schemeId });
  }

  create(data: CurriculumSubjectInput) {
    return this.prisma.curriculumSubject.create({
      data,
      include: {
        curriculumScheme: { select: { id: true, name: true, year: true } },
        subject: { select: { id: true, subjectCode: true, subjectName: true } },
        academicUnit: { select: { id: true, name: true, code: true } },
      },
    });
  }

  update(id: string, data: CurriculumSubjectUpdateInput) {
    return this.prisma.curriculumSubject.update({
      where: { id },
      data,
      include: {
        curriculumScheme: { select: { id: true, name: true, year: true } },
        subject: { select: { id: true, subjectCode: true, subjectName: true } },
        academicUnit: { select: { id: true, name: true, code: true } },
      },
    });
  }

  delete(id: string) {
    return this.prisma.curriculumSubject.delete({ where: { id } });
  }

  findBySubjectAndScheme(subjectId: string, schemeId: string) {
    return this.prisma.curriculumSubject.findMany({
      where: { subjectId, curriculumSchemeId: schemeId },
    });
  }

  getSemesterSubjects(schemeId: string, semesterNumber: number) {
    return this.list({ curriculumSchemeId: schemeId, semesterNumber });
  }
}
