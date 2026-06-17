import { prisma } from "@/lib/db";
import { NotFoundError, AppError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { CurriculumSubjectRepository } from "@/modules/curriculum-subjects/repository";
import type { CurriculumSubjectInput, CurriculumSubjectUpdateInput } from "@/modules/curriculum-subjects/validation";

export class CurriculumSubjectService {
  constructor(private readonly repository = new CurriculumSubjectRepository()) {}

  list(filters?: { curriculumSchemeId?: string; semesterNumber?: number; academicUnitId?: string; subjectId?: string }) {
    const where: Record<string, unknown> = {};
    if (filters?.curriculumSchemeId) where.curriculumSchemeId = filters.curriculumSchemeId;
    if (filters?.semesterNumber) where.semesterNumber = filters.semesterNumber;
    if (filters?.academicUnitId) where.academicUnitId = filters.academicUnitId;
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    return this.repository.list(where as any);
  }

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Curriculum subject not found");
    return entity;
  }

  async create(data: CurriculumSubjectInput) {
    const duplicate = await this.repository.list({
      curriculumSchemeId: data.curriculumSchemeId,
      subjectId: data.subjectId,
      semesterNumber: data.semesterNumber,
      groupAssignment: data.groupAssignment,
    } as any);

    if (duplicate.length > 0) {
      throw new AppError("This subject is already placed in this semester with the same group assignment", 409);
    }

    const scheme = await prisma.curriculumScheme.findUnique({ where: { id: data.curriculumSchemeId } });
    if (!scheme) throw new NotFoundError("Curriculum scheme not found");
    if (!scheme.isActive) {
      throw new AppError("Cannot add subjects to an inactive curriculum scheme", 400);
    }

    const unit = await prisma.academicUnit.findUnique({ where: { id: data.academicUnitId } });
    if (!unit) throw new NotFoundError("Academic unit not found");
    if (!unit.isActive) {
      throw new AppError("Cannot use an inactive academic unit for curriculum placement", 400);
    }

    return withUniqueCheck(() => this.repository.create(data));
  }

  async update(id: string, data: CurriculumSubjectUpdateInput) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Curriculum subject not found");
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Curriculum subject not found");
    return this.repository.delete(id);
  }

  async getSemesterSubjects(schemeId: string, semesterNumber: number) {
    return this.repository.getSemesterSubjects(schemeId, semesterNumber);
  }
}
