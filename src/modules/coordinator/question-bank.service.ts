import {
  AiReportStatus,
  ExamCycleStatus,
  QuestionBankStatus,
  SubjectStatus,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { withOptimisticLock, buildOptimisticUpdate, buildOptimisticWhere } from "@/lib/optimistic-lock";
import { DepartmentAccessUtils, type Actor } from "@/modules/coordinator/department-utils";

type BankFilters = {
  departmentId?: string;
  examCycleId?: string;
  status?: "ACTIVE" | "LOCKED";
};

export class QuestionBankWorkflowService {
  constructor(
    private readonly deptUtils = new DepartmentAccessUtils(),
  ) {}

  async listQuestionBanks(actor: Actor, filters: BankFilters = {}) {
    const departmentIds = await this.deptUtils.getAssignedDepartmentIds(actor);
    if (filters.departmentId && !departmentIds.includes(filters.departmentId)) {
      throw new AppError("You do not have access to that department.", 403);
    }

    const banks = await prisma.questionBank.findMany({
      where: {
        subject: {
          departmentId: filters.departmentId ?? { in: departmentIds },
        },
        ...(filters.examCycleId ? { examCycleId: filters.examCycleId } : {}),
        ...(filters.status ? { status: filters.status === QuestionBankStatus.LOCKED ? QuestionBankStatus.LOCKED : { not: QuestionBankStatus.LOCKED } } : {}),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        subject: {
          select: {
            id: true,
            subjectName: true,
            subjectCode: true,
            semester: true,
            department: { select: { id: true, name: true } },
          },
        },
        examCycle: {
          select: { id: true, examType: true, academicYear: { select: { id: true, code: true } }, semester: { select: { id: true, number: true, name: true } } },
        },
        _count: { select: { bankQuestions: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return banks.map((bank) => ({
      ...bank,
      bankStatus: bank.status === QuestionBankStatus.LOCKED ? "LOCKED" : "ACTIVE",
    }));
  }

  async getQuestionBankDetail(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: { include: { department: true } },
        examCycle: { include: { academicYear: true, semester: true } },
        bankQuestions: {
          include: {
            question: {
              include: {
                creator: { select: { id: true, name: true } },
                subjectVersion: { include: { subject: true } },
              },
            },
          },
        },
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
      bankStatus: bank.status === QuestionBankStatus.LOCKED ? "LOCKED" : "ACTIVE",
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

    const bank = await prisma.questionBank.create({
      data: {
        subjectId,
        examCycleId,
        createdById: actor.id,
        status: QuestionBankStatus.IN_PROGRESS,
      },
      include: { subject: true, examCycle: true },
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
    if (bank.status === QuestionBankStatus.LOCKED) {
      throw new AppError("Question bank is already locked.", 409);
    }
    if (bank.examCycle.status !== ExamCycleStatus.ACTIVE) {
      throw new AppError("Only active exam cycles moving toward closure can be locked.", 409);
    }
    if (!bank.examCycle.endDate) {
      throw new AppError("Exam cycle must have an end date before the bank can be locked.", 409);
    }

    return withOptimisticLock(
      () =>
        prisma.questionBank.update({
          where: buildOptimisticWhere(questionBankId, bank.version),
          data: buildOptimisticUpdate({
            status: QuestionBankStatus.LOCKED,
            lockedAt: new Date(),
          }),
        }),
      "Question bank",
    );
  }
}
