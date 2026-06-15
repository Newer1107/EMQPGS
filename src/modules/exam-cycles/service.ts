import { ExamCycleStatus, Prisma } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { ExamCycleRepository } from "@/modules/exam-cycles/repository";
import { ExamCycleInput } from "@/modules/exam-cycles/validation";
import { prisma } from "@/lib/db";
import { withUniqueCheck } from "@/lib/db-helpers";

export class ExamCycleService {
  constructor(private readonly repository = new ExamCycleRepository()) {}

  list() {
    return this.repository.list();
  }

  async create(data: ExamCycleInput) {
    const semester = await prisma.semester.findUnique({
      where: { id: data.semesterId },
      include: { academicYear: true },
    });
    if (!semester) throw new NotFoundError("Semester not found");
    if (semester.academicYearId !== data.academicYearId) {
      throw new AppError("Semester does not belong to the specified academic year.", 400);
    }

    if (data.status === ExamCycleStatus.ACTIVE) {
      return this.activateInTransaction(ExamCycleStatus.ACTIVE, data.departmentId, undefined, data);
    }
    return withUniqueCheck(
      () => this.repository.create(data),
      "ExamCycle_semesterId_examType_departmentId_key",
    );
  }

  async update(id: string, data: Partial<ExamCycleInput>) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Exam cycle not found");

    if (data.semesterId && data.academicYearId) {
      const semester = await prisma.semester.findUnique({
        where: { id: data.semesterId },
        include: { academicYear: true },
      });
      if (!semester) throw new NotFoundError("Semester not found");
      if (semester.academicYearId !== data.academicYearId) {
        throw new AppError("Semester does not belong to the specified academic year.", 400);
      }
    } else if (data.semesterId) {
      const semester = await prisma.semester.findUnique({
        where: { id: data.semesterId },
      });
      if (!semester) throw new NotFoundError("Semester not found");
      if (semester.academicYearId !== (data.academicYearId ?? entity.academicYearId)) {
        throw new AppError("Semester does not belong to the specified academic year.", 400);
      }
    }

    const mergedStatus = data.status ?? entity.status;
    const mergedDept = entity.departmentId;

    if (mergedStatus === ExamCycleStatus.ACTIVE) {
      return this.activateInTransaction(
        ExamCycleStatus.ACTIVE,
        mergedDept,
        id,
        data,
      );
    }

    return this.repository.update(id, data);
  }

  private async activateInTransaction(
    status: ExamCycleStatus,
    departmentId: string,
    excludeId?: string,
    updateData?: Partial<ExamCycleInput> | ExamCycleInput,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const existing = await tx.examCycle.findFirst({
          where: {
            id: excludeId ? { not: excludeId } : undefined,
            status: ExamCycleStatus.ACTIVE,
            departmentId,
          },
        });

        if (existing) {
          throw new AppError(
            "Another active exam cycle already exists for this department",
            409,
          );
        }

        if (updateData && excludeId) {
          return tx.examCycle.update({
            where: { id: excludeId },
            data: updateData,
          });
        }

        if (updateData && !excludeId) {
          return tx.examCycle.create({ data: updateData as ExamCycleInput });
        }

        return null;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
