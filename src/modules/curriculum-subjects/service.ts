import { prisma } from "@/lib/db";
import { NotFoundError, AppError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { CurriculumSubjectRepository } from "@/modules/curriculum-subjects/repository";
import type { CurriculumSubjectInput, CurriculumSubjectUpdateInput } from "@/modules/curriculum-subjects/validation";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/lib/types";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { AutoInitializeService } from "@/modules/auto-initialize/service";

export class CurriculumSubjectService {
  constructor(
    private readonly repository = new CurriculumSubjectRepository(),
    private readonly deptUtils = new DepartmentAccessUtils(),
  ) {}

  list(filters?: { curriculumSchemeId?: string; semesterNumber?: number; departmentId?: string; subjectId?: string }) {
    const where: Record<string, unknown> = {};
    if (filters?.curriculumSchemeId) where.curriculumSchemeId = filters.curriculumSchemeId;
    if (filters?.semesterNumber) where.semesterNumber = filters.semesterNumber;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    return this.repository.list(where as Prisma.CurriculumSubjectWhereInput);
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
    } as Prisma.CurriculumSubjectWhereInput);

    if (duplicate.length > 0) {
      throw new AppError("This subject is already placed in this semester with the same group assignment", 409);
    }

    const scheme = await prisma.curriculumScheme.findUnique({ where: { id: data.curriculumSchemeId } });
    if (!scheme) throw new NotFoundError("Curriculum scheme not found");
    if (!scheme.isActive) {
      throw new AppError("Cannot add subjects to an inactive curriculum scheme", 400);
    }

    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!dept) throw new NotFoundError("Department not found");
    if (!dept.isActive) {
      throw new AppError("Cannot use an inactive department for curriculum placement", 400);
    }

    return withUniqueCheck(() => this.repository.create(data));
  }

  async createWithDepartmentCheck(data: CurriculumSubjectInput, actor: Actor) {
    const subject = await prisma.subject.findUnique({ where: { id: data.subjectId }, include: { department: true } });
    if (!subject) throw new NotFoundError("Subject not found");
    await this.deptUtils.assertDepartmentAccess(actor, subject.departmentId);

    const duplicate = await this.repository.list({
      curriculumSchemeId: data.curriculumSchemeId,
      subjectId: data.subjectId,
      semesterNumber: data.semesterNumber,
      groupAssignment: data.groupAssignment,
    } as Prisma.CurriculumSubjectWhereInput);

    if (duplicate.length > 0) {
      throw new AppError("This subject is already placed in this semester with the same group assignment", 409);
    }

    const scheme = await prisma.curriculumScheme.findUnique({ where: { id: data.curriculumSchemeId } });
    if (!scheme) throw new NotFoundError("Curriculum scheme not found");
    if (!scheme.isActive) {
      throw new AppError("Cannot add subjects to an inactive curriculum scheme", 400);
    }

    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!dept) throw new NotFoundError("Department not found");
    if (!dept.isActive) {
      throw new AppError("Cannot use an inactive department for curriculum placement", 400);
    }

    const result = await withUniqueCheck(() => this.repository.create(data));

    // ponytail: mid-year subject addition → auto-create bank if any active batch semester exists
    const activeSem = await prisma.batchSemester.findFirst({
      where: { status: "ACTIVE", semesterNumber: data.semesterNumber, departmentId: data.departmentId, batch: { curriculumSchemeId: data.curriculumSchemeId } },
    });
    if (activeSem && subject.status === "ACTIVE") {
      const autoInit = new AutoInitializeService();
      await autoInit.initializeForBatchSemester(activeSem.id);
    }

    return result;
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
