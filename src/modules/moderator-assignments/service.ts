import { Role } from "@prisma/client";
import { ModeratorAssignmentRepository } from "@/modules/moderator-assignments/repository";
import type { AssignmentInput } from "@/modules/moderator-assignments/validation";
import { NotificationService } from "@/modules/notifications/service";
import { AppError, NotFoundError } from "@/lib/errors";

export class ModeratorAssignmentService {
  constructor(
    private readonly repository = new ModeratorAssignmentRepository(),
    private readonly notifications = new NotificationService(),
  ) {}

  async assignModerator(questionBankId: string, payload: AssignmentInput) {
    const moderator = await this.repository.findModeratorById(payload.moderatorId);
    if (!moderator) throw new NotFoundError("User not found");
    if (moderator.role !== Role.MODERATOR) {
      throw new AppError("Only users with the MODERATOR role can be assigned.", 400);
    }

    const bank = await this.repository.findQuestionBankById(questionBankId);
    if (!bank) throw new NotFoundError("Question bank not found");

    const existing = await this.repository.findDuplicate(payload.moderatorId, questionBankId);
    if (existing) {
      throw new AppError("Moderator is already assigned to this question bank.", 409);
    }

    const assignment = await this.repository.create(payload.moderatorId, questionBankId);

    await this.notifications.create(
      moderator.id,
      "New moderation assignment",
      `You have been assigned to moderate the question bank for ${bank.subject.subjectName}.`,
      "/dashboard/moderator/questions",
      "ACTION_REQUIRED",
    );

    return assignment;
  }

  async unassignModerator(questionBankId: string, moderatorId: string) {
    const existing = await this.repository.findDuplicate(moderatorId, questionBankId);
    if (!existing) {
      throw new NotFoundError("Assignment not found");
    }
    return this.repository.delete(moderatorId, questionBankId);
  }
}
