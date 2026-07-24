import { getCurrentUserFromCookies } from "@/lib/api-context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/page-header";
import { NotificationInbox } from "@/components/moderator/notification-inbox";

async function loadNotifications(userId: string) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true, message: true, type: true, actionUrl: true, isRead: true, createdAt: true },
    }),
    prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
  ]);
  return { notifications, unreadCount };
}

export default async function NotificationsPage() {
  const user = await getCurrentUserFromCookies();
  const data = await loadNotifications(user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description={`${data.unreadCount} unread · ${data.notifications.length} total`} />
      <NotificationInbox initialNotifications={data.notifications as any} unreadCount={data.unreadCount} variant="card" showClearAll />
    </div>
  );
}
