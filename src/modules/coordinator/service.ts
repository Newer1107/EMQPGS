import {
  ExamCycleStatus,
  QuestionBankPhase,
  QuestionStatus,
  RecordStatus,
  SubjectStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { NotificationService } from "@/modules/notifications/service";
import { DepartmentAccessUtils, type AuthContext } from "@/modules/coordinator/department-utils";

type QuestionFilters = {
  subjectId?: string;
  moduleNumber?: number;
  markType?: number;
  status?: QuestionStatus;
  contributorId?: string;
};

export type BankStatusItem = {
  id: string;
  subjectName: string;
  subjectCode: string;
  department: string;
  semesterLabel: string;
  phase: string;
  recordStatus: string;
  fillPercentage: number;
  approvedPercentage: number;
  daysInPhase: number;
  totalSlots: number;
  filledCount: number;
  approvedCount: number;
  pendingModerationCount: number;
  rejectedCount: number;
  nextAction: string;
  hasModerator: boolean;
  aiReportStatus: string | null;
  attentionFlags?: Array<"stalled" | "missing_moderator" | "low_fill" | "ready_to_advance" | "readiness_flagged">;
  priorityScore: number;
};

export type AttentionItem = {
  type: "stalled" | "missing_moderator" | "ready_to_advance" | "low_fill";
  bankId: string;
  subject: string;
  subjectCode: string;
  phase: string;
  daysInPhase: number;
  detail: string;
};

export type PhaseDistribution = {
  drafting: number;
  moderation: number;
  approval: number;
  complete: number;
};

const STALL_DAYS_THRESHOLD = 7;

function computeNextAction(
  phase: string,
  recordStatus: string,
  fillPct: number,
  pendingCount: number,
  approvedCount: number,
  totalSlots: number,
  aiReportStatus: string | undefined | null,
  hasGeneratedPapers: boolean,
  hasDeanReview: boolean,
): string {
  if (recordStatus === "LOCKED") return "Locked";

  switch (phase) {
    case "DRAFTING":
      if (fillPct < 100) return "Assign Questions";
      return "Ready for Moderation";
    case "MODERATION":
      if (pendingCount > 0) return "Await Moderation";
      return "Ready for Approval";
    case "APPROVAL":
      if (aiReportStatus !== "COMPLETED") return "Generate AI Report";
      return "Review AI Report";
    case "COMPLETE":
      if (recordStatus === "LOCKED") return "Locked";
      if (hasDeanReview) return "Lock Bank";
      if (hasGeneratedPapers) return "Dean Review";
      return "Generate Papers";
    default:
      return "—";
  }
}

function computeDaysInPhase(updatedAt: Date): number {
  return Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)));
}

export class CoordinatorService {
  constructor(
    private readonly notifications = new NotificationService(),
    private readonly deptUtils = new DepartmentAccessUtils(),
  ) {}

  async getDashboard(authContext: AuthContext) {
    const departmentIds = await this.deptUtils.getAssignedDepartmentIds(authContext);

    const [departments, activeCycles, banks, recentQuestions, notifications] = await Promise.all([
      prisma.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, name: true },
      }),
      prisma.examCycle.findMany({
        where: { status: ExamCycleStatus.ACTIVE },
        select: {
          id: true,
          examType: true,
          startDate: true,
          endDate: true,
          batchSemester: { select: { semesterNumber: true, academicYear: { select: { id: true, code: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.questionBank.findMany({
        where: { subject: { departmentId: { in: departmentIds } } },
        include: {
          subject: {
            select: {
              id: true,
              subjectName: true,
              subjectCode: true,
              departmentId: true,
              department: { select: { name: true } },
            },
          },
          batchSemester: {
            select: { semesterNumber: true, academicYear: { select: { id: true, code: true } } },
          },
          pattern: { select: { totalSlots: true } },
          slots: {
            where: { assignedQuestionId: { not: null } },
            select: {
              assignedQuestion: { select: { status: true } },
            },
          },
          _count: { select: { slots: true } },
          aiReports: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
          generatedPapers: { select: { id: true } },
          deanReview: { select: { id: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.questionLibraryItem.findMany({
        where: { subjectVersion: { subject: { departmentId: { in: departmentIds } } } },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          createdAt: true,
          creator: { select: { name: true } },
          subjectVersion: { select: { subject: { select: { subjectName: true } } } },
        },
        orderBy: { submittedAt: "desc" },
        take: 12,
      }),
      this.notifications.listForUser(authContext.user.id, 25),
    ]);

    const unreadNotificationCount = notifications.filter((item) => !item.isRead).length;

    const bankIds = banks.map((b) => b.id);
    const moderatorAssignments = bankIds.length > 0
      ? await prisma.responsibilityAssignment.findMany({
          where: { scopeId: { in: bankIds }, scopeType: "QUESTION_BANK", responsibility: "MODERATOR" },
          select: { scopeId: true },
        })
      : [];
    const bankIdsWithModerator = new Set(moderatorAssignments.map((a) => a.scopeId).filter((id): id is string => id !== null));

    const bankStatuses: BankStatusItem[] = banks.map((bank) => {
      const totalSlots = bank.pattern?.totalSlots ?? 126;
      const filledCount = bank.slots.length;
      const approvedCount = bank.slots.filter(
        (s) => s.assignedQuestion?.status === QuestionStatus.APPROVED,
      ).length;
      const pendingModerationCount = bank.slots.filter(
        (s) =>
          s.assignedQuestion?.status === QuestionStatus.PENDING ||
          s.assignedQuestion?.status === QuestionStatus.REVISION_SUBMITTED,
      ).length;
      const rejectedCount = bank.slots.filter(
        (s) =>
          s.assignedQuestion?.status === QuestionStatus.REJECTED ||
          s.assignedQuestion?.status === QuestionStatus.REVISION_REQUESTED,
      ).length;

      const fillPercentage = totalSlots > 0
        ? Math.round((filledCount / totalSlots) * 100)
        : 0;
      const approvedPercentage = totalSlots > 0
        ? Math.round((approvedCount / totalSlots) * 100)
        : 0;
      const daysInPhase = computeDaysInPhase(bank.updatedAt);
      const hasModerator = bankIdsWithModerator.has(bank.id);
      const aiReportStatus = bank.aiReports[0]?.status ?? null;
      const hasGeneratedPapers = bank.generatedPapers.length > 0;
      const hasDeanReview = bank.deanReview !== null;

      const nextAction = computeNextAction(
        bank.phase,
        bank.recordStatus,
        fillPercentage,
        pendingModerationCount,
        approvedCount,
        totalSlots,
        aiReportStatus,
        hasGeneratedPapers,
        hasDeanReview,
      );

      const attentionFlags: Array<"stalled" | "missing_moderator" | "low_fill" | "ready_to_advance" | "readiness_flagged"> = [];
      if (daysInPhase > STALL_DAYS_THRESHOLD && bank.phase !== QuestionBankPhase.COMPLETE) attentionFlags.push("stalled");
      if ((bank.phase === QuestionBankPhase.DRAFTING || bank.phase === QuestionBankPhase.MODERATION) && !hasModerator) attentionFlags.push("missing_moderator");
      if (bank.phase === QuestionBankPhase.DRAFTING && fillPercentage < 100) attentionFlags.push("low_fill");
      if (
        (bank.phase === QuestionBankPhase.DRAFTING && fillPercentage >= 100) ||
        (bank.phase === QuestionBankPhase.MODERATION && pendingModerationCount === 0 && filledCount > 0) ||
        (bank.phase === QuestionBankPhase.APPROVAL && aiReportStatus === "COMPLETED")
      ) attentionFlags.push("ready_to_advance");

      // ponytail: priorityScore = stalled (highest) > missing_mod > ready_advance > low_fill > normal
      let priorityScore = 0;
      if (attentionFlags.includes("stalled")) priorityScore = 1000 + daysInPhase;
      else if (attentionFlags.includes("missing_moderator")) priorityScore = 800;
      else if (attentionFlags.includes("ready_to_advance")) {
        if (bank.phase === QuestionBankPhase.APPROVAL) priorityScore = 700;
        else if (bank.phase === QuestionBankPhase.MODERATION) priorityScore = 600;
        else priorityScore = 500;
      } else if (attentionFlags.includes("low_fill")) priorityScore = 400;

      return {
        id: bank.id,
        subjectName: bank.subject.subjectName,
        subjectCode: bank.subject?.subjectCode ?? '',
        department: bank.subject?.department?.name ?? '',
        semesterLabel: `Sem ${bank.batchSemester?.semesterNumber ?? ''} · ${bank.batchSemester?.academicYear?.code ?? ''}`,
        phase: bank.phase,
        recordStatus: bank.recordStatus,
        fillPercentage,
        approvedPercentage,
        daysInPhase,
        totalSlots,
        filledCount,
        approvedCount,
        pendingModerationCount,
        rejectedCount,
        nextAction,
        hasModerator,
        aiReportStatus,
        attentionFlags,
        priorityScore,
      };
    });

    const phaseDistribution: PhaseDistribution = {
      drafting: banks.filter((b) => b.phase === QuestionBankPhase.DRAFTING).length,
      moderation: banks.filter((b) => b.phase === QuestionBankPhase.MODERATION).length,
      approval: banks.filter((b) => b.phase === QuestionBankPhase.APPROVAL).length,
      complete: banks.filter((b) => b.phase === QuestionBankPhase.COMPLETE).length,
    };

    const attentionItems: AttentionItem[] = [];
    for (const bank of bankStatuses) {
      if (bank.recordStatus === "LOCKED") continue;

      if (bank.daysInPhase > STALL_DAYS_THRESHOLD && bank.phase !== "COMPLETE") {
        attentionItems.push({
          type: "stalled",
          bankId: bank.id,
          subject: bank.subjectName,
          subjectCode: bank.subjectCode,
          phase: bank.phase,
          daysInPhase: bank.daysInPhase,
          detail: `${bank.daysInPhase} days in ${bank.phase.toLowerCase()}`,
        });
      }

      if (
        (bank.phase === "DRAFTING" || bank.phase === "MODERATION") &&
        !bank.hasModerator
      ) {
        attentionItems.push({
          type: "missing_moderator",
          bankId: bank.id,
          subject: bank.subjectName,
          subjectCode: bank.subjectCode,
          phase: bank.phase,
          daysInPhase: bank.daysInPhase,
          detail: "No moderator assigned",
        });
      }

      if (
        (bank.phase === "DRAFTING" && bank.fillPercentage >= 100) ||
        (bank.phase === "MODERATION" && bank.pendingModerationCount === 0 && bank.filledCount > 0) ||
        (bank.phase === "APPROVAL" && bank.aiReportStatus === "COMPLETED")
      ) {
        attentionItems.push({
          type: "ready_to_advance",
          bankId: bank.id,
          subject: bank.subjectName,
          subjectCode: bank.subjectCode,
          phase: bank.phase,
          daysInPhase: bank.daysInPhase,
          detail: `Ready to advance from ${bank.phase.toLowerCase()}`,
        });
      }

      if (bank.attentionFlags?.includes("low_fill")) {
        attentionItems.push({
          type: "low_fill",
          bankId: bank.id,
          subject: bank.subjectName,
          subjectCode: bank.subjectCode,
          phase: bank.phase,
          daysInPhase: bank.daysInPhase,
          detail: `${bank.fillPercentage}% filled — assign more questions`,
        });
      }
    }

    return {
      assignedDepartments: departments.map((department) => ({
        id: department.id,
        name: department.name,
        activeSubjects: 0,
        activeQuestionBanks: banks.filter(
          (b) => b.subject?.departmentId === department.id && b.recordStatus !== RecordStatus.LOCKED,
        ).length,
      })),
      activeExamCycles: activeCycles.map((cycle) => ({
        id: cycle.id,
        name: `Sem ${cycle.batchSemester.semesterNumber} · ${cycle.batchSemester.academicYear.code} · ${cycle.examType.replaceAll("_", " ")}`,
        startDate: cycle.startDate?.toISOString() ?? null,
        endDate: cycle.endDate?.toISOString() ?? null,
        department: "",

      })),
      phaseDistribution,
      attentionItems,
      bankStatuses,
      recentContributionActivity: recentQuestions.map((question) => ({
        id: question.id,
        subjectName: question.subjectVersion.subject.subjectName,
        contributorName: question.creator.name,
        status: question.status,
        submittedAt: question.submittedAt?.toISOString() ?? question.createdAt.toISOString(),
      })),
      notifications: notifications.map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        type: item.type,
        actionUrl: item.actionUrl,
        isRead: item.isRead,
        createdAt: item.createdAt.toISOString(),
      })),
      unreadNotificationCount,
    };
  }

  async listQuestions(authContext: AuthContext, filters: QuestionFilters = {}) {
    const departmentIds = await this.deptUtils.getAssignedDepartmentIds(authContext);
    if (filters.subjectId) {
      const subject = await prisma.subject.findUnique({
        where: { id: filters.subjectId },
        select: { departmentId: true },
      });
      if (!subject) throw new NotFoundError("Subject not found");
      if (!departmentIds.includes(subject.departmentId)) {
        throw new ForbiddenError("You do not have access to that subject.");
      }
    }

    return prisma.questionLibraryItem.findMany({
      where: {
        subjectVersion: {
          subject: {
            departmentId: { in: departmentIds },
            ...(filters.subjectId ? { id: filters.subjectId } : {}),
          },
        },
        ...(filters.moduleNumber ? { moduleNumber: filters.moduleNumber } : {}),
        ...(filters.markType ? { marks: filters.markType } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.contributorId ? { createdById: filters.contributorId } : {}),
      },
      select: {
        id: true,
        questionText: true,
        moduleNumber: true,
        marks: true,
        status: true,
        submittedAt: true,
        createdAt: true,
        creator: { select: { id: true, name: true, email: true } },
        subjectVersion: { select: { subject: { select: { subjectName: true, subjectCode: true } } } },
      },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });
  }

  async getQuestionDetail(authContext: AuthContext, questionId: string) {
    const question = await prisma.questionLibraryItem.findUnique({
      where: { id: questionId },
      include: {
        creator: true,
        subjectVersion: { include: { subject: true } },
      },
    });
    if (!question) throw new NotFoundError("Question not found");
    await this.deptUtils.assertDepartmentAccess(authContext, question.subjectVersion.subject.departmentId);

    return {
      ...question,
      attachments: [],
      statusHistory: [
        { status: "CREATED", actor: question.creator.name, timestamp: question.createdAt.toISOString() },
        ...(question.submittedAt ? [{ status: question.status, actor: question.creator.name, timestamp: question.submittedAt.toISOString() }] : []),
        ...(question.reviewedAt ? [{ status: question.status, actor: "Moderator", timestamp: question.reviewedAt.toISOString() }] : []),
      ],
    };
  }
}
