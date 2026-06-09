import { AssignmentRole } from "@prisma/client";
import { AssignmentRepository } from "@/modules/assignments/repository";
import { NotificationService } from "@/modules/notifications/service";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

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
}
