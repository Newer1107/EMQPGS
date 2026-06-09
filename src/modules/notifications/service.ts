import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { EmailService } from "@/modules/notifications/email-service";

export class NotificationService {
  constructor(private readonly emailService = new EmailService()) {}

  listForUser(recipientId: string) {
    return prisma.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  create(recipientId: string, title: string, message: string, actionUrl?: string, type: NotificationType = NotificationType.INFO) {
    return prisma.notification.create({
      data: { recipientId, title, message, actionUrl, type },
    });
  }

  async createAndEmail(
    recipient: { id: string; email: string; name: string },
    title: string,
    message: string,
    actionUrl?: string,
    type: NotificationType = NotificationType.INFO,
  ) {
    await this.create(recipient.id, title, message, actionUrl, type);
    await this.emailService.sendNotificationEmail(recipient.email, title, `${recipient.name}, ${message}`);
  }
}
