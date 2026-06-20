import { ExamCycleStatus } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { ExamCycleRepository } from "@/modules/exam-cycles/repository";
import type { ExamCycleInput } from "@/modules/exam-cycles/validation";
import { prisma } from "@/lib/db";

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

  async create(data: ExamCycleInput) {
    const batchSemester = await prisma.batchSemester.findUnique({
      where: { id: data.batchSemesterId },
      include: {
        batch: { include: { curriculumScheme: true } },
        department: true,
        academicYear: true,
      },
    });
    if (!batchSemester) throw new NotFoundError("Batch semester not found");
    if (!batchSemester.batch.curriculumSchemeId) {
      throw new AppError("Batch has no curriculum scheme assigned.", 400);
    }

    const curriculumSubjects = await prisma.curriculumSubject.findMany({
      where: {
        curriculumSchemeId: batchSemester.batch.curriculumSchemeId,
        semesterNumber: batchSemester.semesterNumber,
        departmentId: batchSemester.departmentId,
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

    return prisma.$transaction(async (tx) => {
      const cycle = await tx.examCycle.create({
        data: {
          examType: data.examType,
          status: data.status ?? ExamCycleStatus.DRAFT,
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
              department: { select: { id: true, name: true, code: true } },
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
    return this.repository.update(id, data);
  }
}
