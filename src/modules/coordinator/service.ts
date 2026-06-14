import {
  AiReportStatus,
  AssignmentRole,
  ExamCycleStatus,
  NotificationType,
  QuestionBankStatus,
  QuestionStatus,
  Role,
  SubjectStatus,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { withOptimisticLock, buildOptimisticUpdate, buildOptimisticWhere } from "@/lib/optimistic-lock";
import { withUniqueCheck } from "@/lib/db-helpers";
import { NotificationService } from "@/modules/notifications/service";
import { QuestionService } from "@/modules/questions/service";
import { ReportService } from "@/modules/reports/service";
import { QUESTION_MODULE_COUNT, QUESTION_SLOT_COUNT, QUESTION_MARKS } from "@/modules/questions/slot-template";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

type SubjectPayload = {
  subjectCode: string;
  subjectName: string;
  departmentId: string;
  semester: number;
  creditLoad: number;
};

type SubjectUpdatePayload = {
  subjectCode?: string;
  subjectName?: string;
  semester?: number;
  creditLoad?: number;
};

type QuestionFilters = {
  subjectId?: string;
  moduleNumber?: number;
  markType?: number;
  status?: QuestionStatus;
  contributorId?: string;
};

type SubjectFilters = {
  departmentId?: string;
  semester?: number;
  status?: SubjectStatus;
};

type BankFilters = {
  departmentId?: string;
  examCycleId?: string;
  status?: "ACTIVE" | "LOCKED";
};

type AssignmentSummary = {
  assignmentId: string;
  moduleNumber: number;
  contributor: {
    id: string;
    name: string;
    email: string;
  };
  questionsSubmittedCount: number;
  canReassign: boolean;
};

export class CoordinatorService {
  constructor(
    private readonly notifications = new NotificationService(),
    private readonly questionService = new QuestionService(),
    private readonly reportService = new ReportService(),
  ) {}

  async getDashboard(actor: Actor) {
    const departmentIds = await this.getAssignedDepartmentIds(actor);

    const [departments, activeCycles, questionBanks, recentQuestions, notifications] = await Promise.all([
      prisma.department.findMany({
        where: { id: { in: departmentIds } },
        select: {
          id: true,
          name: true,
          subjects: { where: { status: SubjectStatus.ACTIVE }, select: { id: true } },
          examCycles: { where: { status: ExamCycleStatus.ACTIVE }, select: { id: true } },
        },
      }),
      prisma.examCycle.findMany({
        where: {
          departmentId: { in: departmentIds },
          status: ExamCycleStatus.ACTIVE,
        },
        select: {
          id: true,
          academicYear: true,
          semester: true,
          examType: true,
          startDate: true,
          endDate: true,
          department: { select: { name: true } },
          _count: { select: { questionBanks: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.questionBank.findMany({
        where: { subject: { departmentId: { in: departmentIds } } },
        select: {
          id: true,
          status: true,
          subject: {
            select: {
              id: true,
              subjectName: true,
              subjectCode: true,
              departmentId: true,
              department: { select: { name: true } },
            },
          },
          examCycle: {
            select: { id: true, academicYear: true, semester: true, examType: true },
          },
          questionSlots: {
            select: {
              id: true,
              reservedById: true,
              question: { select: { status: true } },
            },
          },
          assignments: {
            where: { assignmentRole: AssignmentRole.CONTRIBUTOR },
            select: { moduleNumber: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.question.findMany({
        where: { questionBank: { subject: { departmentId: { in: departmentIds } } } },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          createdAt: true,
          contributor: { select: { name: true } },
          questionBank: { select: { subject: { select: { subjectName: true } } } },
        },
        orderBy: { submittedAt: "desc" },
        take: 12,
      }),
      this.notifications.listForUser(actor.id, 25),
    ]);

    const unreadNotificationCount = notifications.filter((item) => !item.isRead).length;

    return {
      assignedDepartments: departments.map((department) => ({
        id: department.id,
        name: department.name,
        activeSubjects: department.subjects.length,
        activeQuestionBanks: questionBanks.filter((bank) => bank.subject.departmentId === department.id && bank.status !== QuestionBankStatus.LOCKED).length,
      })),
      activeExamCycles: activeCycles.map((cycle) => ({
        id: cycle.id,
        name: `${cycle.academicYear} · Sem ${cycle.semester} · ${cycle.examType.replaceAll("_", " ")}`,
        startDate: cycle.startDate?.toISOString() ?? null,
        endDate: cycle.endDate?.toISOString() ?? null,
        department: cycle.department?.name ?? "Unassigned",
        initializedBanks: cycle._count.questionBanks,
      })),
      subjectBankStatuses: questionBanks.map((bank) => {
        const slotStats = summarizeBankSlots(bank.questionSlots);
        return {
          id: bank.id,
          subjectName: bank.subject.subjectName,
          subjectCode: bank.subject.subjectCode,
          department: bank.subject.department.name,
          examCycle: `${bank.examCycle.academicYear} · Sem ${bank.examCycle.semester} · ${bank.examCycle.examType.replaceAll("_", " ")}`,
          ...slotStats,
        };
      }),
      recentContributionActivity: recentQuestions.map((question) => ({
        id: question.id,
        subjectName: question.questionBank.subject.subjectName,
        contributorName: question.contributor.name,
        status: question.status,
        submittedAt: question.submittedAt?.toISOString() ?? question.createdAt.toISOString(),
      })),
      pendingTeacherAssignments: questionBanks.flatMap((bank) => {
        const assignedModules = new Set(bank.assignments.map((assignment) => assignment.moduleNumber).filter((value): value is number => value != null));
        return Array.from({ length: QUESTION_MODULE_COUNT }, (_, index) => index + 1)
          .filter((moduleNumber) => !assignedModules.has(moduleNumber))
          .map((moduleNumber) => ({
            bankId: bank.id,
            subjectName: bank.subject.subjectName,
            moduleNumber,
          }));
      }),
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

  async listSubjects(actor: Actor, filters: SubjectFilters = {}) {
    const departmentIds = await this.getAssignedDepartmentIds(actor);
    if (filters.departmentId && !departmentIds.includes(filters.departmentId)) {
      throw new ForbiddenError("You do not have access to that department.");
    }

    return prisma.subject.findMany({
      where: {
        departmentId: { in: departmentIds },
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.semester ? { semester: filters.semester } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      select: {
        id: true,
        subjectCode: true,
        subjectName: true,
        academicYear: true,
        semester: true,
        credits: true,
        status: true,
        questionBankDueDate: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true, code: true } },
        examCycleLinks: {
          select: {
            id: true,
            examCycle: { select: { id: true, academicYear: true, semester: true, examType: true, status: true } },
          },
        },
        questionBanks: {
          select: {
            id: true,
            status: true,
            examCycle: { select: { id: true, examType: true } },
            questionSlots: {
              select: {
                id: true,
                question: { select: { status: true } },
              },
            },
          },
        },
      },
      orderBy: [{ departmentId: "asc" }, { semester: "asc" }, { subjectCode: "asc" }],
    });
  }

  async createSubject(actor: Actor, payload: SubjectPayload) {
    const department = await prisma.department.findUnique({
      where: { id: payload.departmentId },
      select: { id: true },
    });
    if (!department) {
      throw new NotFoundError("Department not found");
    }
    if (actor.role === Role.COORDINATOR) {
      await this.assertDepartmentAccess(actor, payload.departmentId);
    }

    return withUniqueCheck(
      () =>
        prisma.subject.create({
          data: {
            subjectCode: payload.subjectCode,
            subjectName: payload.subjectName,
            academicYear: currentAcademicYear(),
            semester: payload.semester,
            credits: payload.creditLoad,
            status: SubjectStatus.ACTIVE,
            questionBankDueDate: addDays(30),
            departmentId: payload.departmentId,
          },
          include: { department: true },
        }),
      "Subject_subjectCode_departmentId_key",
    );
  }

  async updateSubject(actor: Actor, subjectId: string, payload: SubjectUpdatePayload) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFoundError("Subject not found");
    await this.assertDepartmentAccess(actor, subject.departmentId);

    return prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(payload.subjectCode !== undefined ? { subjectCode: payload.subjectCode } : {}),
        ...(payload.subjectName !== undefined ? { subjectName: payload.subjectName } : {}),
        ...(payload.semester !== undefined ? { semester: payload.semester } : {}),
        ...(payload.creditLoad !== undefined ? { credits: payload.creditLoad } : {}),
      },
      include: { department: true },
    });
  }

  async deactivateSubject(actor: Actor, subjectId: string) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFoundError("Subject not found");
    await this.assertDepartmentAccess(actor, subject.departmentId);

    return prisma.subject.update({
      where: { id: subjectId },
      data: { status: SubjectStatus.INACTIVE },
      include: { department: true },
    });
  }

  async linkSubjectToExamCycle(actor: Actor, subjectId: string, examCycleId: string) {
    const [subject, examCycle] = await Promise.all([
      prisma.subject.findUnique({ where: { id: subjectId } }),
      prisma.examCycle.findUnique({ where: { id: examCycleId } }),
    ]);

    if (!subject) throw new NotFoundError("Subject not found");
    if (!examCycle) throw new NotFoundError("Exam cycle not found");
    await this.assertDepartmentAccess(actor, subject.departmentId);
    if (examCycle.departmentId !== subject.departmentId) {
      throw new AppError("Exam cycle must belong to the same department as the subject.", 400);
    }
    if (examCycle.status !== "ACTIVE") {
      throw new AppError("Only active exam cycles can be linked.", 400);
    }

    return prisma.subjectExamCycleLink.upsert({
      where: { subjectId_examCycleId: { subjectId, examCycleId } },
      update: {},
      create: { subjectId, examCycleId },
      include: { subject: true, examCycle: true },
    });
  }

  async listQuestionBanks(actor: Actor, filters: BankFilters = {}) {
    const departmentIds = await this.getAssignedDepartmentIds(actor);
    if (filters.departmentId && !departmentIds.includes(filters.departmentId)) {
      throw new ForbiddenError("You do not have access to that department.");
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
          select: { id: true, academicYear: true, semester: true, examType: true },
        },
        questionSlots: {
          select: {
            id: true,
            question: { select: { status: true } },
          },
        },
        aiReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true },
        },
        generatedPapers: {
          orderBy: { variant: "asc" },
          select: { id: true, variant: true, status: true },
        },
        deanReview: {
          select: {
            id: true,
            reviewedBy: { select: { id: true, name: true } },
            reviewedAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return banks.map((bank) => {
      const slotStats = summarizeBankSlots(bank.questionSlots);
      const approvedSlots = slotStats.approvedCount;
      const readiness = approvedSlots >= 60
        ? bank.generatedPapers.length > 0
          ? "Ready for Dean Review"
          : bank.aiReports[0]?.status === AiReportStatus.COMPLETED
            ? "Ready for Generation"
            : "Ready for AI Analysis"
        : "Insufficient approved questions";

      return {
        ...bank,
        bankStatus: bank.status === QuestionBankStatus.LOCKED ? "LOCKED" : "ACTIVE",
        readiness,
        ...slotStats,
      };
    });
  }

  async initializeQuestionBank(actor: Actor, subjectId: string, examCycleId: string) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: { examCycleLinks: true },
    });
    if (!subject) throw new NotFoundError("Subject not found");
    await this.assertDepartmentAccess(actor, subject.departmentId);
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

    await this.questionService.ensureSlotGrid(bank.id);
    return bank;
  }

  async getQuestionBankDetail(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: { include: { department: true } },
        examCycle: true,
        questionSlots: {
          include: {
            reservedBy: true,
            question: {
              include: {
                contributor: true,
                attachments: { include: { fileAsset: true } },
              },
            },
          },
          orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
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
    await this.assertDepartmentAccess(actor, bank.subject.departmentId);

    return {
      ...bank,
      bankStatus: bank.status === QuestionBankStatus.LOCKED ? "LOCKED" : "ACTIVE",
      slotStats: summarizeBankSlots(bank.questionSlots),
      readinessThresholdMet: summarizeBankSlots(bank.questionSlots).approvedCount >= 60,
    };
  }

  async lockQuestionBank(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: true, examCycle: true },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.assertDepartmentAccess(actor, bank.subject.departmentId);
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

  async listAssignments(actor: Actor, questionBankId?: string) {
    const departmentIds = await this.getAssignedDepartmentIds(actor);
    if (questionBankId) {
      const bank = await prisma.questionBank.findUnique({
        where: { id: questionBankId },
        include: { subject: true },
      });
      if (!bank) throw new NotFoundError("Question bank not found");
      if (!departmentIds.includes(bank.subject.departmentId)) {
        throw new ForbiddenError("You do not have access to that question bank.");
      }
    }

    const assignments = await prisma.teacherAssignment.findMany({
      where: {
        questionBank: {
          subject: {
            departmentId: { in: departmentIds },
          },
        },
        ...(questionBankId ? { questionBankId } : {}),
      },
      include: {
        teacher: true,
        questionBank: { include: { subject: true, examCycle: true } },
      },
      orderBy: [{ questionBankId: "asc" }, { moduleNumber: "asc" }],
    });

    const questionCounts = await prisma.question.groupBy({
      by: ["questionBankId", "moduleNumber", "contributorId"],
      where: {
        questionBank: {
          subject: {
            departmentId: { in: departmentIds },
          },
        },
        ...(questionBankId ? { questionBankId } : {}),
      },
      _count: {
        _all: true,
      },
    });

    const countByKey = new Map(
      questionCounts.map((item) => [`${item.questionBankId}:${item.moduleNumber}:${item.contributorId}`, item._count._all]),
    );

    return assignments
      .filter((assignment) => assignment.assignmentRole === AssignmentRole.CONTRIBUTOR && assignment.moduleNumber != null)
      .map((assignment) => {
        const questionsSubmittedCount = countByKey.get(`${assignment.questionBankId}:${assignment.moduleNumber}:${assignment.teacherId}`) ?? 0;
        return {
          assignmentId: assignment.id,
          moduleNumber: assignment.moduleNumber!,
          contributor: {
            id: assignment.teacher.id,
            name: assignment.teacher.name,
            email: assignment.teacher.email,
          },
          questionsSubmittedCount,
          canReassign: questionsSubmittedCount === 0,
        } satisfies AssignmentSummary;
      });
  }

  async assignContributor(actor: Actor, questionBankId: string, moduleNumber: number, contributorId: string) {
    const [bank, contributor] = await Promise.all([
      prisma.questionBank.findUnique({ where: { id: questionBankId }, include: { subject: true } }),
      prisma.user.findUnique({ where: { id: contributorId } }),
    ]);
    if (!bank) throw new NotFoundError("Question bank not found");
    if (!contributor) throw new NotFoundError("Contributor not found");
    await this.assertDepartmentAccess(actor, bank.subject.departmentId);
    if (contributor.role !== Role.CONTRIBUTOR) {
      throw new AppError("Only users with the CONTRIBUTOR role can be assigned.", 400);
    }
    if (contributor.departmentId !== bank.subject.departmentId) {
      throw new ForbiddenError("Contributor must belong to the same department.");
    }

    const assignment = await withUniqueCheck(
      () =>
        prisma.teacherAssignment.create({
          data: {
            questionBankId,
            teacherId: contributorId,
            assignmentRole: AssignmentRole.CONTRIBUTOR,
            moduleNumber,
            assignedById: actor.id,
          },
          include: {
            teacher: true,
            questionBank: { include: { subject: true } },
          },
        }),
      "TeacherAssignment_questionBankId_teacherId_assignmentRole_moduleNumber_key",
    );

    await this.notifications.create(
      contributorId,
      `Assignment updated for ${bank.subject.subjectCode}`,
      `You have been assigned to Module ${moduleNumber} for ${bank.subject.subjectName}.`,
      "/dashboard/contributor/my-subjects",
      NotificationType.ACTION_REQUIRED,
    );

    return {
      assignmentId: assignment.id,
      moduleNumber,
      contributor: {
        id: assignment.teacher.id,
        name: assignment.teacher.name,
        email: assignment.teacher.email,
      },
      questionsSubmittedCount: 0,
      canReassign: true,
    } satisfies AssignmentSummary;
  }

  async reassignContributor(actor: Actor, questionBankId: string, assignmentId: string, contributorId: string) {
    const assignment = await prisma.teacherAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        questionBank: { include: { subject: true } },
      },
    });
    if (!assignment) throw new NotFoundError("Assignment not found");
    if (assignment.questionBankId !== questionBankId) throw new AppError("Assignment does not belong to that question bank.", 400);
    await this.assertDepartmentAccess(actor, assignment.questionBank.subject.departmentId);
    if (assignment.assignmentRole !== AssignmentRole.CONTRIBUTOR || assignment.moduleNumber == null) {
      throw new AppError("Only contributor module assignments can be reassigned.", 400);
    }

    const submittedQuestions = await prisma.question.count({
      where: {
        questionBankId,
        moduleNumber: assignment.moduleNumber,
        contributorId: assignment.teacherId,
      },
    });
    if (submittedQuestions > 0) {
      throw new AppError("Cannot reassign - contributor has already submitted questions.", 409);
    }

    const contributor = await prisma.user.findUnique({ where: { id: contributorId } });
    if (!contributor) throw new NotFoundError("Contributor not found");
    if (contributor.role !== Role.CONTRIBUTOR) {
      throw new AppError("Only users with the CONTRIBUTOR role can be assigned.", 400);
    }
    if (contributor.departmentId !== assignment.questionBank.subject.departmentId) {
      throw new ForbiddenError("Contributor must belong to the same department.");
    }

    const updated = await prisma.teacherAssignment.update({
      where: { id: assignmentId },
      data: { teacherId: contributorId },
      include: { teacher: true, questionBank: { include: { subject: true } } },
    });

    return {
      assignmentId: updated.id,
      moduleNumber: updated.moduleNumber!,
      contributor: {
        id: updated.teacher.id,
        name: updated.teacher.name,
        email: updated.teacher.email,
      },
      questionsSubmittedCount: 0,
      canReassign: true,
    } satisfies AssignmentSummary;
  }

  async removeAssignment(actor: Actor, questionBankId: string, assignmentId: string) {
    const assignment = await prisma.teacherAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        questionBank: { include: { subject: true } },
      },
    });
    if (!assignment) throw new NotFoundError("Assignment not found");
    if (assignment.questionBankId !== questionBankId) throw new AppError("Assignment does not belong to that question bank.", 400);
    await this.assertDepartmentAccess(actor, assignment.questionBank.subject.departmentId);

    await prisma.teacherAssignment.delete({ where: { id: assignmentId } });
    return { deleted: true };
  }

  async notifyAssignment(actor: Actor, questionBankId: string, assignmentId: string) {
    const assignment = await prisma.teacherAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        teacher: true,
        questionBank: { include: { subject: true } },
      },
    });
    if (!assignment) throw new NotFoundError("Assignment not found");
    if (assignment.questionBankId !== questionBankId) throw new AppError("Assignment does not belong to that question bank.", 400);
    await this.assertDepartmentAccess(actor, assignment.questionBank.subject.departmentId);

    await this.notifications.createAndEmail(
      assignment.teacher,
      "Contribution reminder",
      `You have been assigned to contribute questions for ${assignment.questionBank.subject.subjectName} - Module ${assignment.moduleNumber}. Please log in and begin your contribution.`,
      "/dashboard/contributor/my-subjects",
      NotificationType.ACTION_REQUIRED,
    );

    return { notified: true, contributorName: assignment.teacher.name };
  }

  async listQuestions(actor: Actor, filters: QuestionFilters = {}) {
    const departmentIds = await this.getAssignedDepartmentIds(actor);
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

    return prisma.question.findMany({
      where: {
        questionBank: {
          subject: {
            departmentId: { in: departmentIds },
            ...(filters.subjectId ? { id: filters.subjectId } : {}),
          },
        },
        ...(filters.moduleNumber ? { moduleNumber: filters.moduleNumber } : {}),
        ...(filters.markType ? { marks: filters.markType } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.contributorId ? { contributorId: filters.contributorId } : {}),
      },
      select: {
        id: true,
        questionText: true,
        moduleNumber: true,
        marks: true,
        slotNumber: true,
        status: true,
        submittedAt: true,
        createdAt: true,
        contributor: { select: { id: true, name: true, email: true } },
        questionBank: { select: { id: true, subject: { select: { subjectName: true, subjectCode: true } } } },
      },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });
  }

  async listContributors(actor: Actor, departmentId?: string) {
    const departmentIds = await this.getAssignedDepartmentIds(actor);
    if (departmentId && !departmentIds.includes(departmentId)) {
      throw new ForbiddenError("You do not have access to that department.");
    }

    return prisma.user.findMany({
      where: {
        role: Role.CONTRIBUTOR,
        departmentId: departmentId ?? { in: departmentIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
        departmentId: true,
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
  }

  async getQuestionDetail(actor: Actor, questionId: string) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        contributor: true,
        attachments: { include: { fileAsset: true } },
        questionBank: { include: { subject: true } },
      },
    });
    if (!question) throw new NotFoundError("Question not found");
    await this.assertDepartmentAccess(actor, question.questionBank.subject.departmentId);

    const statusHistory = [
      { status: "CREATED", actor: question.contributor.name, timestamp: question.createdAt.toISOString() },
      ...(question.submittedAt ? [{ status: question.status === QuestionStatus.REVISION_SUBMITTED ? "REVISION_SUBMITTED" : "PENDING", actor: question.contributor.name, timestamp: question.submittedAt.toISOString() }] : []),
      ...(question.reviewedAt ? [{ status: question.status, actor: "Moderator", timestamp: question.reviewedAt.toISOString() }] : []),
    ];

    return {
      ...question,
      attachments: question.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileAsset.fileName,
        mimeType: attachment.fileAsset.mimeType,
        downloadUrl: `/api/question-attachments/${attachment.id}/download`,
      })),
      statusHistory,
    };
  }

  async getAssignedDepartmentIds(actor: Actor) {
    if (actor.role !== Role.COORDINATOR) throw new ForbiddenError("Only coordinators can access this resource.");
    const assignments = await prisma.coordinatorDepartmentAssignment.findMany({
      where: { coordinatorId: actor.id },
      select: { departmentId: true },
    });
    const departmentIds = assignments.map((assignment) => assignment.departmentId);
    if (departmentIds.length === 0) {
      throw new ForbiddenError("Coordinator is not assigned to any departments.");
    }
    return departmentIds;
  }

  async assertDepartmentAccess(actor: Actor, departmentId: string) {
    const assignedDepartmentIds = await this.getAssignedDepartmentIds(actor);
    if (!assignedDepartmentIds.includes(departmentId)) {
      throw new ForbiddenError("You do not have access to that department.");
    }
  }

  async triggerAiAnalysis(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: true, questionSlots: { include: { question: true } } },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.assertDepartmentAccess(actor, bank.subject.departmentId);
    const slotStats = summarizeBankSlots(bank.questionSlots);
    if (slotStats.approvedCount < 60) {
      throw new AppError("Question bank does not meet the minimum approved-question threshold for AI analysis.", 409);
    }

    const report = await this.reportService.createAiReport(questionBankId, actor);
    await this.notifications.create(
      actor.id,
      "AI analysis ready",
      `AI analysis report is ready for ${bank.subject.subjectName}.`,
      `/dashboard/coordinator/question-banks?bank=${questionBankId}`,
      NotificationType.INFO,
    );
    return report;
  }

  async listAiReports(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({ where: { id: questionBankId }, include: { subject: true } });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.assertDepartmentAccess(actor, bank.subject.departmentId);
    return this.reportService.listAiReports(questionBankId);
  }

  async triggerPaperGeneration(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: true },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.assertDepartmentAccess(actor, bank.subject.departmentId);
    const generatedPapers = await this.reportService.generatePapers(questionBankId, actor, ["PAPER_A", "PAPER_B", "PAPER_C"]);
    await this.notifications.create(
      actor.id,
      "Paper generation complete",
      `Papers A, B, C have been generated for ${bank.subject.subjectName}.`,
      `/dashboard/coordinator/question-banks?bank=${questionBankId}`,
      NotificationType.SUCCESS,
    );
    return generatedPapers;
  }

  async listGeneratedPapers(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({ where: { id: questionBankId }, include: { subject: true, deanReview: true } });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.assertDepartmentAccess(actor, bank.subject.departmentId);
    const papers = await this.reportService.listGeneratedPapers(questionBankId);
    return {
      papers,
      deanReview: bank.deanReview,
    };
  }

  async getDeanReviewStatus(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: true,
        deanReview: {
          include: {
            reviewedBy: true,
          },
        },
      },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.assertDepartmentAccess(actor, bank.subject.departmentId);

    return bank.deanReview
      ? {
          complete: true,
          review: {
            regularPaper: bank.deanReview.regularPaper,
            supplementaryPaper: bank.deanReview.supplementaryPaper,
            ktPaper: bank.deanReview.ktPaper,
            reviewedAt: bank.deanReview.reviewedAt.toISOString(),
            reviewedBy: {
              id: bank.deanReview.reviewedBy.id,
              name: bank.deanReview.reviewedBy.name,
              email: bank.deanReview.reviewedBy.email,
            },
          },
        }
      : { complete: false, review: null };
  }
}

function summarizeBankSlots(
  slots: Array<{
    reservedById?: string | null;
    question: {
      status: QuestionStatus;
    } | null;
  }>,
) {
  const totalSlots = QUESTION_MODULE_COUNT * QUESTION_MARKS.length * QUESTION_SLOT_COUNT;
  let filledCount = 0;
  let pendingModerationCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (const slot of slots) {
    if (slot.question) {
      filledCount += 1;
      if (slot.question.status === QuestionStatus.PENDING || slot.question.status === QuestionStatus.REVISION_SUBMITTED) pendingModerationCount += 1;
      if (slot.question.status === QuestionStatus.APPROVED) approvedCount += 1;
      if (slot.question.status === QuestionStatus.REJECTED || slot.question.status === QuestionStatus.REVISION_REQUESTED) rejectedCount += 1;
    }
  }

  return {
    totalSlots,
    filledCount,
    pendingModerationCount,
    approvedCount,
    rejectedCount,
    fillPercentage: Number(((filledCount / totalSlots) * 100).toFixed(2)),
  };
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function currentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  return `${year}-${year + 1}`;
}
