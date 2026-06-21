import { ContributorAssignmentRepository } from "@/modules/contributor-assignments/repository";
import type { ContributorAssignmentInput } from "@/modules/contributor-assignments/validation";
import { NotificationService } from "@/modules/notifications/service";
import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db";

export class ContributorAssignmentService {
  constructor(
    private readonly repository = new ContributorAssignmentRepository(),
    private readonly notifications = new NotificationService(),
  ) {}

  async assignContributor(questionBankId: string, payload: ContributorAssignmentInput, assignedById: string) {
    const contributor = await prisma.user.findUnique({
      where: { id: payload.contributorId },
      select: { id: true, name: true, email: true },
    });
    if (!contributor) throw new NotFoundError("User not found");

    const bank = await this.repository.findQuestionBankById(questionBankId);
    if (!bank) throw new NotFoundError("Question bank not found");

    const existing = await this.repository.findDuplicate(payload.contributorId, questionBankId);
    if (existing) {
      throw new AppError("This user is already assigned as Contributor for this Question Bank.", 409);
    }

    const assignment = await this.repository.create(payload.contributorId, questionBankId, assignedById);

    await this.notifications.create(
      contributor.id,
      "New question bank assignment",
      `You have been assigned to contribute questions for ${bank.subject.subjectName}.`,
      "/dashboard/contributor/my-subjects",
      "ACTION_REQUIRED",
    );

    return assignment;
  }

  async unassignContributor(questionBankId: string, contributorId: string, deletedById: string) {
    const existing = await this.repository.findDuplicate(contributorId, questionBankId);
    if (!existing) {
      throw new NotFoundError("Assignment not found");
    }
    return this.repository.delete(contributorId, questionBankId, deletedById);
  }

  listAssignments(questionBankId: string) {
    return this.repository.listByBank(questionBankId);
  }
}
