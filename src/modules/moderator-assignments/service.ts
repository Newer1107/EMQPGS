import { ModeratorAssignmentRepository } from "@/modules/moderator-assignments/repository";
import type { AssignmentInput } from "@/modules/moderator-assignments/validation";
import { NotificationService } from "@/modules/notifications/service";
import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db";

export class ModeratorAssignmentService {
  constructor(
    private readonly repository = new ModeratorAssignmentRepository(),
    private readonly notifications = new NotificationService(),
  ) {}

  async assignModerator(questionBankId: string, payload: AssignmentInput, assignedById: string) {
    const moderator = await prisma.user.findUnique({
      where: { id: payload.moderatorId },
      select: { id: true, name: true, email: true },
    });
    if (!moderator) throw new NotFoundError("User not found");

    const bank = await this.repository.findQuestionBankById(questionBankId);
    if (!bank) throw new NotFoundError("Question bank not found");

    const existing = await this.repository.findDuplicate(payload.moderatorId, questionBankId);
    if (existing) {
      throw new AppError("This user is already assigned as Moderator for this Question Bank.", 409);
    }

    const assignment = await this.repository.create(payload.moderatorId, questionBankId, assignedById);

    await this.notifications.create(
      moderator.id,
      "New moderation assignment",
      `You have been assigned to moderate the question bank for ${bank.subject.subjectName}.`,
      "/dashboard/moderator/questions",
      "ACTION_REQUIRED",
    );

    return assignment;
  }

  async unassignModerator(questionBankId: string, moderatorId: string, deletedById: string) {
    const existing = await this.repository.findDuplicate(moderatorId, questionBankId);
    if (!existing) {
      throw new NotFoundError("Assignment not found");
    }
    return this.repository.delete(moderatorId, questionBankId, deletedById);
  }
}
