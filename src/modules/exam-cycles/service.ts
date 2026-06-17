import { ExamCycleStatus, Prisma } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { ExamCycleRepository } from "@/modules/exam-cycles/repository";
import { ExamCycleInput, BatchExamCycleInput } from "@/modules/exam-cycles/validation";
import { prisma } from "@/lib/db";
import { withUniqueCheck } from "@/lib/db-helpers";

export class ExamCycleService {
  constructor(private readonly repository = new ExamCycleRepository()) {}

  list(take?: number, skip?: number) {
    return this.repository.list(take, skip);
  }

  async findByBatch(batchId: string) {
    return this.repository.findByBatch(batchId);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  // Legacy create path — unchanged
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

  // Batch-aware creation from a BatchSemester
  // All academic context is derived from the BatchSemester relation.
  async createFromBatch(data: BatchExamCycleInput) {
    const batchSemester = await prisma.batchSemester.findUnique({
      where: { id: data.batchSemesterId },
      include: {
        batch: { include: { curriculumScheme: true } },
        academicUnit: true,
        academicYear: true,
      },
    });
    if (!batchSemester) throw new NotFoundError("Batch semester not found");
    if (!batchSemester.batch.curriculumSchemeId) {
      throw new AppError("Batch has no curriculum scheme assigned.", 400);
    }

    // Discover all curriculum subjects for this batch-semester context
    // Group-specific subjects (GROUP_1, GROUP_2) are included alongside ALL subjects.
    // The group distinction lives on CurriculumSubject, not on ExamCycle.
    const curriculumSubjects = await prisma.curriculumSubject.findMany({
      where: {
        curriculumSchemeId: batchSemester.batch.curriculumSchemeId,
        semesterNumber: batchSemester.semesterNumber,
        academicUnitId: batchSemester.academicUnitId,
      },
      include: { subject: true },
    });

    if (curriculumSubjects.length === 0 && !data.subjectOverrides) {
      throw new AppError(
        `No subjects found for semester ${batchSemester.semesterNumber} in this batch's curriculum. Add curriculum subjects first or provide subject overrides.`,
        400,
      );
    }

    const subjectIds = data.subjectOverrides && data.subjectOverrides.length > 0
      ? data.subjectOverrides
      : [...new Set(curriculumSubjects.map((cs) => cs.subjectId))];

    if (subjectIds.length === 0) {
      throw new AppError("No subjects to link to this exam cycle.", 400);
    }

    const dept = await prisma.department.findFirst();
    const legacySemester = await prisma.semester.findFirst({
      where: { academicYearId: batchSemester.academicYearId, number: batchSemester.semesterNumber },
    });

    return prisma.$transaction(async (tx) => {
      const cycle = await tx.examCycle.create({
        data: {
          examType: data.examType,
          status: data.status ?? ExamCycleStatus.DRAFT,
          departmentId: dept?.id ?? "",
          academicYearId: batchSemester.academicYearId,
          semesterId: legacySemester?.id ?? "",
          batchSemesterId: batchSemester.id,
          timetableDocumentRef: data.timetableDocumentRef,
          timetableIssueDate: data.timetableIssueDate,
          timetableTitle: data.timetableTitle,
          timetableRows: data.timetableRows,
          timetableSignature: data.timetableSignature,
        },
      });

      for (const subjectId of subjectIds) {
        await tx.subjectExamCycleLink.create({
          data: { subjectId, examCycleId: cycle.id },
        });
      }

      return tx.examCycle.findUnique({
        where: { id: cycle.id },
        include: {
          batchSemester: {
            include: {
              batch: { select: { id: true, name: true, code: true } },
              academicUnit: { select: { id: true, name: true, code: true } },
            },
          },
          subjectLinks: { include: { subject: { select: { id: true, subjectCode: true, subjectName: true } } } },
        },
      });
    });
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
