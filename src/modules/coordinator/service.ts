import {
  ExamCycleStatus,
  QuestionBankStatus,
  QuestionStatus,
  SubjectStatus,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { NotificationService } from "@/modules/notifications/service";
import { DepartmentAccessUtils, type Actor } from "@/modules/coordinator/department-utils";
import { QUESTION_MODULE_COUNT } from "@/modules/questions/slot-template";

type QuestionFilters = {
  subjectId?: string;
  moduleNumber?: number;
  markType?: number;
  status?: QuestionStatus;
  contributorId?: string;
};

export class CoordinatorService {
  constructor(
    private readonly notifications = new NotificationService(),
    private readonly deptUtils = new DepartmentAccessUtils(),
  ) {}

  async getDashboard(actor: Actor) {
    const departmentIds = await this.deptUtils.getAssignedDepartmentIds(actor);

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
          examType: true,
          startDate: true,
          endDate: true,
          department: { select: { name: true } },
          academicYear: { select: { id: true, code: true } },
          semester: { select: { id: true, number: true, name: true } },
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
            select: { id: true, examType: true, academicYear: { select: { id: true, code: true } }, semester: { select: { id: true, number: true, name: true } } },
          },
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
        name: `${cycle.semester.name} · ${cycle.academicYear.code} · ${cycle.examType.replaceAll("_", " ")}`,
        startDate: cycle.startDate?.toISOString() ?? null,
        endDate: cycle.endDate?.toISOString() ?? null,
        department: cycle.department?.name ?? "Unassigned",
        initializedBanks: cycle._count.questionBanks,
      })),
      subjectBankStatuses: [],
      recentContributionActivity: recentQuestions.map((question) => ({
        id: question.id,
        subjectName: question.subjectVersion.subject.subjectName,
        contributorName: question.creator.name,
        status: question.status,
        submittedAt: question.submittedAt?.toISOString() ?? question.createdAt.toISOString(),
      })),
      pendingTeacherAssignments: [],
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

  async listQuestions(actor: Actor, filters: QuestionFilters = {}) {
    const departmentIds = await this.deptUtils.getAssignedDepartmentIds(actor);
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

  async getQuestionDetail(actor: Actor, questionId: string) {
    const question = await prisma.questionLibraryItem.findUnique({
      where: { id: questionId },
      include: {
        creator: true,
        subjectVersion: { include: { subject: true } },
      },
    });
    if (!question) throw new NotFoundError("Question not found");
    await this.deptUtils.assertDepartmentAccess(actor, question.subjectVersion.subject.departmentId);

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
