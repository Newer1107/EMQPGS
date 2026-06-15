import { QuestionStatus, type User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotificationService } from "@/modules/notifications/service";
import { ModeratorService } from "@/modules/moderation/service";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

export class ModeratorDashboardService {
  constructor(
    private readonly notifications = new NotificationService(),
    private readonly moderatorService = new ModeratorService(),
  ) {}

  async getDashboard(actor: Actor) {
    const bankIds = await this.moderatorService.getAssignedBankIds(actor);

    const questionCounts = await prisma.questionLibraryItem.groupBy({
      by: ["status"],
      where: { bankLinks: { some: { questionBankId: { in: bankIds } } } },
      _count: { _all: true },
    });

    const pending = questionCounts.find((item) => item.status === QuestionStatus.PENDING)?._count._all ?? 0;
    const approved = questionCounts.find((item) => item.status === QuestionStatus.APPROVED)?._count._all ?? 0;
    const rejected = questionCounts.find((item) => item.status === QuestionStatus.REJECTED)?._count._all ?? 0;
    const revisionRequested = questionCounts.find((item) => item.status === QuestionStatus.REVISION_REQUESTED)?._count._all ?? 0;

    const [notifications] = await Promise.all([
      this.notifications.listForUser(actor.id, 50),
    ]);

    return {
      summary: { pending, approved, rejected, revisionRequested, awaitingRevisionResubmission: revisionRequested },
      awaitingRevisionResubmission: [],
      recentModerationActivity: [],
      quickAccessBanks: [],
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        actionUrl: n.actionUrl,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadNotificationCount: notifications.filter((n) => !n.isRead).length,
    };
  }
}
