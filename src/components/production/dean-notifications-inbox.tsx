"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/client-fetch";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

export function DeanNotificationsInbox({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  async function markAsRead(notificationId: string) {
    try {
      const response = await apiFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });
      const result = await response.json();
      if (!result.success) return;

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, isRead: true } : notification,
        ),
      );
    } catch {
      // Silently fail — this is a non-critical UX enhancement
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Notification Inbox</CardTitle>
          <Badge>{unreadCount} unread</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No notifications yet.</p>
        ) : notifications.map((notification) => (
          <div key={notification.id} className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{notification.title}</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{notification.message}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </div>
              {!notification.isRead ? <Badge>Unread</Badge> : <Badge className="bg-white">Read</Badge>}
            </div>
            <div className="mt-3 flex items-center gap-3">
              {notification.actionUrl ? (
                <Link href={notification.actionUrl} className="text-sm font-medium underline underline-offset-4">
                  Open
                </Link>
              ) : null}
              {!notification.isRead ? (
                <Button type="button" size="sm" variant="outline" onClick={() => markAsRead(notification.id)}>
                  Mark as read
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
