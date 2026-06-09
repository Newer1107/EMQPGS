import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";

export class NotificationService {
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
}
