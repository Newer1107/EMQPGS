"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export function NotificationInbox({
  initialNotifications,
  unreadCount,
}: {
  initialNotifications: NotificationItem[];
  unreadCount: number;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [count, setCount] = useState(unreadCount);
  const [busy, setBusy] = useState(false);

  async function markOne(id: string) {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.isRead) return;

    setBusy(true);
    const response = await apiFetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds: [id] }),
    });
    const result = await response.json();
    setBusy(false);

    if (!response.ok || !result.success) {
      toast.error(result.error?.message ?? "Failed to mark notification as read.");
      return;
    }

    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setCount((current) => Math.max(0, current - 1));
  }

  async function clearAll() {
    setBusy(true);
    const response = await apiFetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    const result = await response.json();
    setBusy(false);

    if (!response.ok || !result.success) {
      toast.error(result.error?.message ?? "Failed to clear notifications.");
      return;
    }

    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setCount(0);
    toast.success("Notifications cleared.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Unread: {count}</p>
        <Button type="button" size="sm" variant="outline" disabled={busy || count === 0} onClick={() => void clearAll()}>
          Clear All
        </Button>
      </div>
      <div className="space-y-3">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            className={`w-full rounded-lg border p-3 text-left ${notification.isRead ? "border-[var(--border)] bg-white" : "border-[var(--foreground)] bg-[var(--muted)]"}`}
            onClick={() => void markOne(notification.id)}
          >
            <p className="font-medium">{notification.title}</p>
            <p className="text-sm text-[var(--muted-foreground)]">{notification.message}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
