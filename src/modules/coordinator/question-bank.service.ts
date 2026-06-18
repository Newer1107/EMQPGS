import {
  CoordinatorDecision,
  ExamCycleStatus,
  ExamType,
  QuestionBankPhase,
  RecordStatus,
  SnapshotType,
  SubjectStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { ENTITY_TYPES } from "@/lib/constants";
import { withOptimisticLock, buildOptimisticUpdate, buildOptimisticWhere } from "@/lib/optimistic-lock";
import { DepartmentAccessUtils, type Actor } from "@/modules/coordinator/department-utils";
import { ensureQuestionBankMutable } from "@/modules/question-banks/mutable-guard";
import { QuestionBankService } from "@/modules/question-banks/service";

type BankFilters = {
  departmentId?: string;
  examCycleId?: string;
  status?: "ACTIVE" | "LOCKED";
};

export class QuestionBankWorkflowService {
  constructor(
    private readonly deptUtils = new DepartmentAccessUtils(),
    private readonly questionBankService = new QuestionBankService(),
  ) {}

  async listQuestionBanks(actor: Actor, filters: BankFilters = {}, take = 50, skip = 0) {
    const departmentIds = await this.deptUtils.getAssignedDepartmentIds(actor);
    if (filters.departmentId && !departmentIds.includes(filters.departmentId)) {
      throw new AppError("You do not have access to that department.", 403);
    }

    const banks = await prisma.questionBank.findMany({
      take: Math.min(take, 500),
      skip,
      where: {
        subject: {
          departmentId: filters.departmentId ?? { in: departmentIds },
        },
        ...(filters.examCycleId ? { examCycleId: filters.examCycleId } : {}),
        ...(filters.status
          ? { recordStatus: filters.status === "LOCKED" ? RecordStatus.LOCKED : { not: RecordStatus.LOCKED } }
          : {}),
      },
      select: {
        id: true,
        phase: true,
        recordStatus: true,
        createdAt: true,
        updatedAt: true,
        subject: {
          select: {
            id: true,
            subjectName: true,
            subjectCode: true,
            department: { select: { id: true, name: true } },
          },
        },
        examCycle: {
          select: { id: true, examType: true, batchSemester: { select: { semesterNumber: true, academicYear: { select: { id: true, code: true } } } } },
        },
        _count: { select: { slots: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return banks.map((bank) => ({
      ...bank,
      bankStatus: bank.recordStatus === RecordStatus.LOCKED ? "LOCKED" : "ACTIVE",
    }));
  }

  async getQuestionBankDetail(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: { include: { department: true } },
        examCycle: { include: { batchSemester: { include: { academicYear: true, batch: { select: { id: true, name: true } }, academicUnit: { select: { id: true, name: true } } } } } },
        slots: {
          include: {
            assignedQuestion: {
              include: {
                creator: { select: { id: true, name: true } },
                subjectVersion: { include: { subject: true } },
              },
            },
          },
          orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
        },
        pattern: true,
        aiReports: { orderBy: { createdAt: "desc" }, take: 1 },
        generatedPapers: {
          orderBy: { variant: "asc" },
          include: {
            items: { include: { question: true } },
          },
        },
        deanReview: { include: { reviewedBy: true } },
      },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(actor, bank.subject.departmentId);

    return {
      ...bank,
      bankStatus: bank.recordStatus === RecordStatus.LOCKED ? "LOCKED" : "ACTIVE",
    };
  }

  async initializeQuestionBank(actor: Actor, subjectId: string, examCycleId: string) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: { examCycleLinks: true },
    });
    if (!subject) throw new NotFoundError("Subject not found");
    await this.deptUtils.assertDepartmentAccess(actor, subject.departmentId);
    if (subject.status !== SubjectStatus.ACTIVE) {
      throw new AppError("Cannot initialize a bank for an inactive subject.", 409);
    }
    if (!subject.examCycleLinks.some((link) => link.examCycleId === examCycleId)) {
      throw new AppError("Subject must be linked to the exam cycle before initializing a bank.", 400);
    }

    const examCycle = await prisma.examCycle.findUnique({ where: { id: examCycleId } });
    if (!examCycle) throw new NotFoundError("Exam cycle not found");

    const pattern = DEFAULT_PATTERNS[examCycle.examType];
    const slotData = buildSlotsFromPattern(pattern);

    const bank = await prisma.questionBank.create({
      data: {
        subjectId,
        examCycleId,
        phase: QuestionBankPhase.DRAFTING,
        recordStatus: RecordStatus.ACTIVE,
        createdById: actor.id,
        pattern: { create: pattern },
        slots: { createMany: { data: slotData } },
      },
      include: { subject: true, examCycle: true, pattern: true, slots: true },
    });

    return bank;
  }

  async lockQuestionBank(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: true, examCycle: true },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(actor, bank.subject.departmentId);
    if (bank.recordStatus === RecordStatus.LOCKED) {
      throw new AppError("Question bank is already locked.", 409);
    }
    if (bank.examCycle.status !== ExamCycleStatus.ACTIVE) {
      throw new AppError("Only active exam cycles moving toward closure can be locked.", 409);
    }
    if (!bank.examCycle.endDate) {
      throw new AppError("Exam cycle must have an end date before the bank can be locked.", 409);
    }

    const slots = await prisma.questionSlot.findMany({
      where: { questionBankId },
      select: { id: true, moduleNumber: true, marks: true, slotNumber: true, assignedQuestionId: true, isLocked: true },
    });

    return withOptimisticLock(
      () =>
        prisma.$transaction(async (tx) => {
          const updated = await tx.questionBank.update({
            where: buildOptimisticWhere(questionBankId, bank.version),
            data: buildOptimisticUpdate({
              recordStatus: RecordStatus.LOCKED,
              lockedAt: new Date(),
            }),
          });
          await tx.questionBankSnapshot.create({
            data: {
              questionBankId,
              snapshotType: SnapshotType.LOCKED,
              phase: updated.phase,
              status: RecordStatus.LOCKED,
              slotAssignments: slots,
              version: updated.version,
            },
          });
          return updated;
        }),
      "Question bank",
    );
  }

  async advancePhase(actor: Actor, id: string, targetPhase: QuestionBankPhase) {
    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: { subject: { select: { departmentId: true } } },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(actor, bank.subject.departmentId);
    return this.questionBankService.advancePhase(id, targetPhase);
  }

  async coordinatorDecision(questionBankId: string, decision: CoordinatorDecision, remark: string | undefined, actor: Actor) {
    if (actor.role !== "COORDINATOR") throw new ForbiddenError("Only coordinators can approve or reject reports");
    const bank = await prisma.questionBank.findUnique({ where: { id: questionBankId } });
    if (!bank) throw new NotFoundError("Question bank not found");
    ensureQuestionBankMutable(bank.recordStatus);
    if (bank.phase !== QuestionBankPhase.APPROVAL) {
      throw new AppError("Coordinator decision can only be made when the bank is in APPROVAL phase.", 409);
    }

    const targetPhase =
      decision === CoordinatorDecision.APPROVED
        ? QuestionBankPhase.COMPLETE
        : QuestionBankPhase.MODERATION;

    const [approvalDecision] = await prisma.$transaction([
      prisma.approvalDecision.create({
        data: {
          questionBankId,
          decision,
          remark: remark ?? null,
          decidedById: actor.id,
        },
      }),
      prisma.questionBank.update({
        where: { id: questionBankId, version: bank.version },
        data: { phase: targetPhase, version: { increment: 1 } },
      }),
    ]);

    await logAudit({
      actorId: actor.id,
      action: decision === CoordinatorDecision.APPROVED ? "QUESTION_BANK_APPROVED" : "QUESTION_BANK_REJECTED",
      entityType: ENTITY_TYPES.QUESTION_BANK,
      entityId: questionBankId,
      metadata: { remark, approvalDecisionId: approvalDecision.id },
    });

    return approvalDecision;
  }
}

const DEFAULT_PATTERNS: Record<ExamType, { examType: ExamType; totalModules: number; marksPattern: number[]; slotsPerModule: number; totalSlots: number }> = {
  [ExamType.ISE_1]: { examType: ExamType.ISE_1, totalModules: 3, marksPattern: [2, 5, 10], slotsPerModule: 7, totalSlots: 63 },
  [ExamType.ISE_2]: { examType: ExamType.ISE_2, totalModules: 3, marksPattern: [2, 5, 10], slotsPerModule: 7, totalSlots: 63 },
  [ExamType.ENDSEM]: { examType: ExamType.ENDSEM, totalModules: 6, marksPattern: [2, 5, 10], slotsPerModule: 7, totalSlots: 126 },
  [ExamType.SUPPLEMENTARY]: { examType: ExamType.SUPPLEMENTARY, totalModules: 6, marksPattern: [2, 5, 10], slotsPerModule: 7, totalSlots: 126 },
  [ExamType.KT]: { examType: ExamType.KT, totalModules: 6, marksPattern: [2, 5, 10], slotsPerModule: 7, totalSlots: 126 },
};

function buildSlotsFromPattern(pattern: { totalModules: number; marksPattern: number[]; slotsPerModule: number }): Array<{ moduleNumber: number; marks: number; slotNumber: number }> {
  const slots: Array<{ moduleNumber: number; marks: number; slotNumber: number }> = [];
  for (let moduleNumber = 1; moduleNumber <= pattern.totalModules; moduleNumber += 1) {
    for (const marks of pattern.marksPattern) {
      for (let slotNumber = 1; slotNumber <= pattern.slotsPerModule; slotNumber += 1) {
        slots.push({ moduleNumber, marks, slotNumber });
      }
    }
  }
  return slots;
}
