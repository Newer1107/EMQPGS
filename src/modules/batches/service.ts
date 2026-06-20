import { prisma } from "@/lib/db";
import { NotFoundError, AppError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { BatchRepository } from "@/modules/batches/repository";
import type { BatchInput, BatchUpdateInput } from "@/modules/batches/validation";

export class BatchService {
  constructor(private readonly repository = new BatchRepository()) {}

  list() {
    return this.repository.list();
  }

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Batch not found");
    return entity;
  }

  async findByDepartment(departmentId: string) {
    return this.repository.findByDepartment(departmentId);
  }

  async create(data: BatchInput) {
    if (data.graduationYear <= data.admissionYear) {
      throw new AppError("Graduation year must be after admission year", 400);
    }

    const existing = await this.repository.findByCode(data.code);
    if (existing) throw new AppError("A batch with this code already exists", 409);

    const department = await prisma.department.findUnique({
      where: { id: data.departmentId },
    });
    if (!department) throw new NotFoundError("Department not found");
    if (!department.isActive) {
      throw new AppError("Cannot create a batch for an inactive department", 400);
    }

    const scheme = await prisma.curriculumScheme.findUnique({ where: { id: data.curriculumSchemeId } });
    if (!scheme) throw new NotFoundError("Curriculum scheme not found");
    if (!scheme.isActive) {
      throw new AppError("Cannot create a batch for an inactive curriculum scheme", 400);
    }

    return withUniqueCheck(
      () =>
        prisma.$transaction(async (tx) => {
          const batch = await tx.batch.create({
            data: {
              name: data.name,
              code: data.code,
              departmentId: data.departmentId,
              curriculumSchemeId: data.curriculumSchemeId,
              admissionYear: data.admissionYear,
              graduationYear: data.graduationYear,
              hasTeachingGroups: data.hasTeachingGroups ?? false,
            },
          });

          const semesterData = [];
          for (let sem = 1; sem <= scheme.durationSemesters; sem++) {
            const academicYearCode = `${data.admissionYear + Math.floor((sem - 1) / 2)}-${data.admissionYear + Math.floor((sem - 1) / 2) + 1}`;
            const academicYear = await tx.academicYear.findUnique({ where: { code: academicYearCode } });
            if (!academicYear) {
              throw new AppError(`Academic year ${academicYearCode} not found. Create it before creating this batch.`, 400);
            }

            semesterData.push({
              batchId: batch.id,
              semesterNumber: sem,
              academicYearId: academicYear.id,
              departmentId: department.id,
              startDate: null,
              endDate: null,
              status: "UPCOMING" as const,
            });
          }

          await tx.batchSemester.createMany({ data: semesterData });

          if (data.hasTeachingGroups) {
            await tx.teachingGroup.createMany({
              data: [
                { batchId: batch.id, groupNumber: 1, name: "Group 1" },
                { batchId: batch.id, groupNumber: 2, name: "Group 2" },
              ],
            });
          }

          return tx.batch.findUnique({
            where: { id: batch.id },
            include: {
              department: true,
              curriculumScheme: true,
              batchSemesters: { orderBy: { semesterNumber: "asc" } },
              teachingGroups: true,
            },
          })!;
        }),
    );
  }

  async update(id: string, data: BatchUpdateInput) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Batch not found");
    if (data.code && data.code !== entity.code) {
      const existing = await this.repository.findByCode(data.code);
      if (existing) throw new AppError("A batch with this code already exists", 409);
    }
    if (data.curriculumSchemeId) {
      const scheme = await prisma.curriculumScheme.findUnique({ where: { id: data.curriculumSchemeId } });
      if (!scheme) throw new NotFoundError("Curriculum scheme not found");
      if (!scheme.isActive) {
        throw new AppError("Cannot assign an inactive curriculum scheme to a batch", 400);
      }
    }
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Batch not found");
    return this.repository.delete(id);
  }

  async getSemesters(id: string) {
    const batch = await this.repository.findById(id);
    if (!batch) throw new NotFoundError("Batch not found");
    return batch.batchSemesters;
  }
}
