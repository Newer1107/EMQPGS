import { prisma } from "@/lib/db";
import { NotFoundError, AppError } from "@/lib/errors";
import { BatchSemesterRepository } from "@/modules/batch-semesters/repository";
import type { BatchSemesterUpdateInput, BatchSemesterActivateInput } from "@/modules/batch-semesters/validation";
import { BatchSemesterStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export class BatchSemesterService {
  constructor(private readonly repository = new BatchSemesterRepository()) {}

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Batch semester not found");
    return entity;
  }

  async findByBatch(batchId: string) {
    return this.repository.findByBatch(batchId);
  }

  async findActiveByDepartment(departmentId: string) {
    return this.repository.findActiveByDepartment(departmentId);
  }

  async update(id: string, data: BatchSemesterUpdateInput) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Batch semester not found");

    const dates: { startDate?: Date; endDate?: Date } = {};
    if (data.startDate) dates.startDate = data.startDate;
    if (data.endDate) dates.endDate = data.endDate;

    if (dates.startDate && dates.endDate && dates.endDate <= dates.startDate) {
      throw new AppError("End date must be after start date", 400);
    }

    if (dates.startDate || dates.endDate) {
      await this.validateNoOverlap(entity.batchId, entity.semesterNumber, dates.startDate ?? entity.startDate!, dates.endDate ?? entity.endDate!);
    }

    return this.repository.update(id, data);
  }

  async activate(id: string, data?: BatchSemesterActivateInput) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Batch semester not found");
    if (entity.status === BatchSemesterStatus.COMPLETED) {
      throw new AppError("Cannot activate a completed semester", 409);
    }
    if (entity.status === BatchSemesterStatus.ACTIVE) {
      throw new AppError("Semester is already active", 409);
    }

    const update: BatchSemesterUpdateInput = { status: BatchSemesterStatus.ACTIVE };
    if (data?.startDate) update.startDate = data.startDate;
    if (data?.endDate) update.endDate = data.endDate;

    const result = await this.repository.update(id, update);

    await prisma.batch.update({
      where: { id: entity.batchId },
      data: { currentBatchSemesterId: id, currentSemesterNumber: entity.semesterNumber },
    });

    return result;
  }

  async complete(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Batch semester not found");
    if (entity.status === BatchSemesterStatus.COMPLETED) {
      throw new AppError("Semester is already completed", 409);
    }

    const nextSem = await this.repository.findByBatchAndNumber(entity.batchId, entity.semesterNumber + 1);
    const result = await this.repository.update(id, {
      status: BatchSemesterStatus.COMPLETED,
      endDate: entity.endDate ?? new Date(),
    });

    const updateData: Record<string, null | string | number> = {};
    if (nextSem) {
      updateData.currentBatchSemesterId = nextSem.id;
      updateData.currentSemesterNumber = nextSem.semesterNumber;
    } else {
      updateData.currentBatchSemesterId = null;
      updateData.currentSemesterNumber = null;
    }

    await prisma.batch.update({
      where: { id: entity.batchId },
      data: updateData as Prisma.BatchUpdateInput,
    });

    return result;
  }

  async updateDates(id: string, startDate: Date, endDate: Date) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Batch semester not found");
    if (endDate <= startDate) {
      throw new AppError("End date must be after start date", 400);
    }
    await this.validateNoOverlap(entity.batchId, entity.semesterNumber, startDate, endDate);
    return this.repository.update(id, { startDate, endDate });
  }

  async getPrevious(batchId: string, semesterNumber: number) {
    return this.repository.findByBatchAndNumber(batchId, semesterNumber - 1);
  }

  async getNext(batchId: string, semesterNumber: number) {
    return this.repository.findByBatchAndNumber(batchId, semesterNumber + 1);
  }

  async getFirst(batchId: string) {
    return this.repository.findFirst(batchId);
  }

  async getLast(batchId: string) {
    return this.repository.findLast(batchId);
  }

  private async validateNoOverlap(
    batchId: string,
    excludeSemester: number,
    startDate: Date,
    endDate: Date,
  ) {
    const allSems = await this.repository.findByBatch(batchId);
    const others = allSems.filter((s) => s.semesterNumber !== excludeSemester);

    for (const other of others) {
      if (!other.startDate || !other.endDate) continue;

      const overlaps = startDate < other.endDate && endDate > other.startDate;
      if (overlaps) {
        throw new AppError(
          `Semester ${excludeSemester}'s dates overlap with semester ${other.semesterNumber} (${other.startDate.toISOString().split("T")[0]} to ${other.endDate.toISOString().split("T")[0]})`,
          400,
        );
      }
    }
  }
}
