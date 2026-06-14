import { AssignmentRole, NotificationType, Role } from "@prisma/client";
import { AssignmentRepository } from "@/modules/assignments/repository";
import { NotificationService } from "@/modules/notifications/service";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";

export class AssignmentService {
  constructor(
    private readonly repository = new AssignmentRepository(),
    private readonly notifications = new NotificationService(),
  ) {}

  list() {
    return this.repository.list();
  }

  async assign(questionBankId: string, assignedById: string, moderatorId?: string, contributorIds: string[] = []) {
    const questionBank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: true },
    });

    if (!questionBank) throw new NotFoundError("Question bank not found");

    const rows = await this.repository.replaceAssignments(questionBankId, assignedById, moderatorId, contributorIds);
    await Promise.all(
      rows.map((row) =>
        this.notifications.create(
          row.teacherId,
          `Assignment updated for ${questionBank.subject.subjectCode}`,
          `You have been assigned as ${row.assignmentRole === AssignmentRole.MODERATOR ? "moderator" : "contributor"}.`,
          "/dashboard/coordinator/assignments",
        ),
      ),
    );

    return rows;
  }

  async assignModerator(questionBankId: string, moderatorId: string) {
    const [questionBank, moderator] = await Promise.all([
      prisma.questionBank.findUnique({ where: { id: questionBankId }, include: { subject: true } }),
      prisma.user.findUnique({ where: { id: moderatorId } }),
    ]);
    if (!questionBank) throw new NotFoundError("Question bank not found");
    if (!moderator) throw new NotFoundError("Moderator not found");
    if (moderator.role !== Role.MODERATOR) {
      throw new AppError("Only users with the MODERATOR role can be assigned as moderator.", 400);
    }

    const existing = await prisma.moderatorBankAssignment.findUnique({
      where: { moderatorId_questionBankId: { moderatorId, questionBankId } },
    });
    if (existing) {
      throw new AppError("Moderator is already assigned to this question bank.", 409);
    }

    const assignment = await prisma.moderatorBankAssignment.create({
      data: { moderatorId, questionBankId },
      include: { moderator: true, questionBank: { include: { subject: true } } },
    });

    await this.notifications.create(
      moderatorId,
      `Assigned as moderator for ${questionBank.subject.subjectCode}`,
      `You have been assigned as moderator for ${questionBank.subject.subjectName}.`,
      `/dashboard/moderator/question-banks/${questionBankId}`,
      NotificationType.ACTION_REQUIRED,
    );

    return assignment;
  }
}
