import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { EmailService } from "@/modules/notifications/email-service";

export class NotificationService {
  constructor(private readonly emailService = new EmailService()) {}

  listForUser(recipientId: string, take = 10) {
    return prisma.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async listAfter(recipientId: string, cursor: string, take = 25) {
    const pivot = await prisma.notification.findUnique({ where: { id: cursor }, select: { createdAt: true } });
    if (!pivot) return { notifications: [], unreadCount: await this.unreadCount(recipientId) };
    const notifications = await prisma.notification.findMany({
      where: { recipientId, createdAt: { lt: pivot.createdAt } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return { notifications, unreadCount: await this.unreadCount(recipientId) };
  }

  unreadCount(recipientId: string) {
    return prisma.notification.count({
      where: { recipientId, isRead: false },
    });
  }

  async create(recipientId: string, title: string, message: string, actionUrl?: string, type: NotificationType = NotificationType.INFO) {
    const notification = await prisma.notification.create({
      data: { recipientId, title, message, actionUrl, type },
    });
    try {
      const user = await prisma.user.findUnique({ where: { id: recipientId }, select: { email: true, name: true } });
      if (user?.email) {
        await this.emailService.sendNotificationEmail(user.email, title, `${user.name}, ${message}`);
      }
    } catch (err) {
      logger.error("Failed to send notification email", { recipientId, title, error: err instanceof Error ? err.message : String(err) });
    }
    return notification;
  }

  async markAsRead(recipientId: string, notificationIds: string[]) {
    if (notificationIds.length === 0) return { count: 0 };
    const result = await prisma.notification.updateMany({
      where: {
        recipientId,
        id: { in: notificationIds },
        isRead: false,
      },
      data: { isRead: true },
    });
    return { count: result.count };
  }

  async markAllAsRead(recipientId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        recipientId,
        isRead: false,
      },
      data: { isRead: true },
    });
    return { count: result.count };
  }

  async markByActionUrlAsRead(recipientId: string, actionUrl: string) {
    const result = await prisma.notification.updateMany({
      where: {
        recipientId,
        actionUrl,
        isRead: false,
      },
      data: { isRead: true },
    });
    return { count: result.count };
  }

  async createAndEmail(
    recipient: { id: string; email: string; name: string },
    title: string,
    message: string,
    actionUrl?: string,
    type: NotificationType = NotificationType.INFO,
  ) {
    await this.create(recipient.id, title, message, actionUrl, type);
    try {
      await this.emailService.sendNotificationEmail(recipient.email, title, `${recipient.name}, ${message}`);
    } catch (err) {
      logger.error("Failed to send notification email", {
        recipientEmail: recipient.email,
        recipientId: recipient.id,
        title,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
