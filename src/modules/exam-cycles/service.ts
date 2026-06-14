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
    if (data.status === ExamCycleStatus.ACTIVE) {
      return this.activateInTransaction(ExamCycleStatus.ACTIVE, data.departmentId ?? null, undefined, data);
    }
    return withUniqueCheck(
      () => this.repository.create(data),
      "ExamCycle_academicYear_semester_examType_key",
    );
  }

  async update(id: string, data: Partial<ExamCycleInput>) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Exam cycle not found");

    const mergedStatus = data.status ?? entity.status;
    const mergedDept = data.departmentId ?? entity.departmentId;

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
    departmentId: string | null,
    excludeId?: string,
    updateData?: Partial<ExamCycleInput> | ExamCycleInput,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const existing = await tx.examCycle.findFirst({
          where: {
            id: excludeId ? { not: excludeId } : undefined,
            status: ExamCycleStatus.ACTIVE,
            departmentId: departmentId ?? null,
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
