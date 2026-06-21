import { BatchSemesterStatus, ExamCycleStatus, ExamType, Prisma, QuestionBankPhase, RecordStatus, SubjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotificationService } from "@/modules/notifications/service";
import { logger } from "@/lib/logger";

const ENDSEM_PATTERN = {
  examType: ExamType.ENDSEM, totalModules: 6, marksPattern: [2, 5, 10], slotsPerModule: 7, totalSlots: 126,
};

export type InitializeResult = {
  banksCreated: number;
  examCyclesCreated: number;
  errors: string[];
};

export class AutoInitializeService {
  constructor(private readonly notifications = new NotificationService()) {}

  async initializeForBatchSemester(batchSemesterId: string): Promise<InitializeResult> {
    const bs = await prisma.batchSemester.findUnique({
      where: { id: batchSemesterId },
      include: {
        academicYear: true,
        batch: { include: { curriculumScheme: { include: { curriculumSubjects: { include: { subject: true } } } } } },
        department: true,
      },
    });
    if (!bs) return { banksCreated: 0, examCyclesCreated: 0, errors: ["Batch semester not found"] };

    const result: InitializeResult = { banksCreated: 0, examCyclesCreated: 0, errors: [] };
    const coeResponsibilityAssignments = await prisma.responsibilityAssignment.findMany({
      where: { responsibility: "COE" as const },
      select: { userId: true },
    });
    const coeUsers = coeResponsibilityAssignments.map((ra) => ({ id: ra.userId }));
    const coeId = coeUsers[0]?.id;
    if (!coeId) { result.errors.push("No COE user found — banks cannot be created without a creator"); return result; }

    const curriculumSubjects = bs.batch.curriculumScheme?.curriculumSubjects.filter(
      (cs) => cs.semesterNumber === bs.semesterNumber && cs.departmentId === bs.departmentId,
    ) ?? [];

    if (curriculumSubjects.length === 0) {
      result.errors.push(`No curriculum subjects for semester ${bs.semesterNumber} in batch ${bs.batch.code}`);
      return result;
    }

    const coordinatorAssignments = await prisma.responsibilityAssignment.findMany({
      where: { scopeId: bs.departmentId, scopeType: "DEPARTMENT", responsibility: "COORDINATOR" },
      select: { userId: true },
    });
    const coordinatorIds = coordinatorAssignments.map((a) => a.userId);

    await prisma.$transaction(async (tx) => {
      for (const cs of curriculumSubjects) {
        if (cs.subject.status !== SubjectStatus.ACTIVE) continue;

        const existing = await tx.questionBank.findUnique({
          where: { batchSemesterId_subjectId: { batchSemesterId, subjectId: cs.subjectId } },
        });
        if (existing) continue;

        const slotData: Array<{ moduleNumber: number; marks: number; slotNumber: number }> = [];
        for (let mod = 1; mod <= ENDSEM_PATTERN.totalModules; mod++) {
          for (const marks of ENDSEM_PATTERN.marksPattern) {
            for (let sn = 1; sn <= ENDSEM_PATTERN.slotsPerModule; sn++) {
              slotData.push({ moduleNumber: mod, marks, slotNumber: sn });
            }
          }
        }

        await tx.questionBank.create({
          data: {
            subjectId: cs.subjectId,
            batchSemesterId,
            academicYearId: bs.academicYearId,
            phase: QuestionBankPhase.DRAFTING,
            recordStatus: RecordStatus.ACTIVE,
            createdById: coeId,
            pattern: { create: ENDSEM_PATTERN },
            slots: { createMany: { data: slotData } },
          },
        });
        result.banksCreated++;
      }

      for (const examType of [ExamType.ISE_1, ExamType.ISE_2, ExamType.ENDSEM] as const) {
        const existingEc = await tx.examCycle.findUnique({
          where: { batchSemesterId_examType: { batchSemesterId, examType } },
        });
        if (existingEc) continue;

        const ec = await tx.examCycle.create({
          data: { examType, status: ExamCycleStatus.DRAFT, version: 1, batchSemesterId },
        });

        for (const cs of curriculumSubjects) {
          if (cs.subject.status !== SubjectStatus.ACTIVE) continue;
          await tx.subjectExamCycleLink.upsert({
            where: { subjectId_examCycleId: { subjectId: cs.subjectId, examCycleId: ec.id } },
            update: {},
            create: { subjectId: cs.subjectId, examCycleId: ec.id },
          });
        }
        result.examCyclesCreated++;
      }
    });

    for (const coordinatorId of coordinatorIds) {
      await this.notifications.create(
        coordinatorId,
        "New semester activated",
        `Semester ${bs.semesterNumber} (${bs.academicYear.code}) is now active. Question banks have been created.`,
        "/dashboard/coordinator/question-banks",
        "ACTION_REQUIRED",
      );
    }

    logger.info(`Auto-init: ${result.banksCreated} banks, ${result.examCyclesCreated} exam cycles for batch-semester ${batchSemesterId}`);
    return result;
  }
}
