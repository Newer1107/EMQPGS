import {
  BatchSemesterStatus,
  CoordinatorDecision,
  QuestionBankPhase,
  RecordStatus,
  SnapshotType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { ENTITY_TYPES } from "@/lib/constants";
import { withOptimisticLock, buildOptimisticUpdate, buildOptimisticWhere } from "@/lib/optimistic-lock";
import { AuthorizationService } from "@/lib/auth/authorization-service";
import { DepartmentAccessUtils, type AuthContext } from "@/modules/coordinator/department-utils";
import { ensureQuestionBankMutable } from "@/modules/question-banks/mutable-guard";
import { QuestionBankService } from "@/modules/question-banks/service";

type BankFilters = {
  departmentId?: string;
  status?: "ACTIVE" | "LOCKED";
};

export class QuestionBankWorkflowService {
  constructor(
    private readonly deptUtils = new DepartmentAccessUtils(),
    private readonly questionBankService = new QuestionBankService(),
  ) {}

  async listQuestionBanks(authContext: AuthContext, filters: BankFilters = {}, take = 50, skip = 0) {
    const departmentIds = await this.deptUtils.getAssignedDepartmentIds(authContext);
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
        batchSemester: {
          select: { id: true, semesterNumber: true, academicYear: { select: { id: true, code: true } } },
        },
        _count: { select: { slots: true } },
        slots: { select: { id: true, assignedQuestionId: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return banks.map((bank) => {
      const filledSlots = bank.slots.filter((s) => s.assignedQuestionId).length;
      return {
        ...bank,
        filledSlots,
        totalSlots: bank._count.slots,
        bankStatus: bank.recordStatus === RecordStatus.LOCKED ? "LOCKED" : "ACTIVE",
      };
    });
  }

  async getQuestionBankDetail(authContext: AuthContext, questionBankId: string) {
    const [bank, moderatorAssignments, contributorAssignments] = await Promise.all([
      prisma.questionBank.findUnique({
        where: { id: questionBankId },
        include: {
          subject: { include: { department: true } },
          batchSemester: {
            include: {
              academicYear: true,
              batch: { select: { id: true, name: true } },
              department: { select: { id: true, name: true } },
            },
          },
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
      }),
      prisma.responsibilityAssignment.findMany({
        where: { scopeId: questionBankId, scopeType: "QUESTION_BANK", responsibility: "MODERATOR" },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.responsibilityAssignment.findMany({
        where: { scopeId: questionBankId, scopeType: "QUESTION_BANK", responsibility: "CONTRIBUTOR" },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(authContext, bank.subject.departmentId);

    return {
      ...bank,
      moderatorAssignments: moderatorAssignments.map((a) => ({ moderator: a.user })),
      contributorAssignments: contributorAssignments.map((a) => ({ contributor: a.user })),
      bankStatus: bank.recordStatus === RecordStatus.LOCKED ? "LOCKED" : "ACTIVE",
    };
  }

  async lockQuestionBank(authContext: AuthContext, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: true, batchSemester: true },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(authContext, bank.subject.departmentId);
    if (bank.recordStatus === RecordStatus.LOCKED) {
      throw new AppError("Question bank is already locked.", 409);
    }
    if (bank.batchSemester.status !== BatchSemesterStatus.ACTIVE) {
      throw new AppError("Only banks in an active semester can be locked.", 409);
    }
    if (!bank.batchSemester.endDate) {
      throw new AppError("Batch semester must have an end date before the bank can be locked.", 409);
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

  async advancePhase(authContext: AuthContext, id: string, targetPhase: QuestionBankPhase) {
    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: { subject: { select: { departmentId: true } } },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(authContext, bank.subject.departmentId);
    return this.questionBankService.advancePhase(id, targetPhase);
  }

  async coordinatorDecision(questionBankId: string, decision: CoordinatorDecision, remark: string | undefined, authContext: AuthContext) {
    new AuthorizationService(authContext).requireCoordinator();
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
          decidedById: authContext.user.id,
        },
      }),
      prisma.questionBank.update({
        where: { id: questionBankId, version: bank.version },
        data: { phase: targetPhase, version: { increment: 1 } },
      }),
    ]);

    await logAudit({
      actorId: authContext.user.id,
      action: decision === CoordinatorDecision.APPROVED ? "QUESTION_BANK_APPROVED" : "QUESTION_BANK_REJECTED",
      entityType: ENTITY_TYPES.QUESTION_BANK,
      entityId: questionBankId,
      metadata: { remark, approvalDecisionId: approvalDecision.id },
    });

    return approvalDecision;
  }
}
