"use client";

import Link from "next/link";
import { useState } from "react";
import { feedback } from "@/lib/feedback";
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

export function NotificationInbox({
  initialNotifications,
  unreadCount,
  variant = "simple",
  showClearAll = true,
  onError = "toast",
}: {
  initialNotifications: NotificationItem[];
  unreadCount?: number;
  variant?: "simple" | "card";
  showClearAll?: boolean;
  onError?: "toast" | "silent";
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const computedCount = notifications.filter((n) => !n.isRead).length;
  const count = unreadCount ?? computedCount;
  const [busy, setBusy] = useState(false);

  async function markOne(id: string) {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.isRead) return;

    setBusy(true);
    try {
      const response = await apiFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [id] }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: { message: `Request failed with status ${response.status}` } }));
        if (onError === "toast") feedback.error(body.error?.message ?? "Failed to mark notification as read.");
        return;
      }

      const result = await response.json();

      if (!result.success) {
        if (onError === "toast") feedback.error(result.error?.message ?? "Failed to mark notification as read.");
        return;
      }

      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    } catch {
      if (onError === "toast") feedback.error("Network request failed. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    setBusy(true);
    try {
      const response = await apiFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: { message: `Request failed with status ${response.status}` } }));
        if (onError === "toast") feedback.error(body.error?.message ?? "Failed to clear notifications.");
        return;
      }

      const result = await response.json();

      if (!result.success) {
        if (onError === "toast") feedback.error(result.error?.message ?? "Failed to clear notifications.");
        return;
      }

      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      if (onError === "toast") feedback.success({ title: "Notifications cleared." });
    } catch {
      if (onError === "toast") feedback.error("Network request failed. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "card") {
    const unread = notifications.filter((n) => !n.isRead).length;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Notification Inbox</CardTitle>
            <Badge>{unread} unread</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No notifications yet.</p>
          ) : notifications.map((notification) => (
            <div key={notification.id} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{notification.title}</p>
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">{notification.message}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {notification.isRead ? <Badge>Read</Badge> : <Badge variant="warning">Unread</Badge>}
              </div>
              <div className="mt-3 flex items-center gap-3">
                {notification.actionUrl ? (
                  <Link href={notification.actionUrl} className="text-sm font-medium underline underline-offset-4">
                    Open
                  </Link>
                ) : null}
                {!notification.isRead ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => markOne(notification.id)}>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Unread: {count}</p>
        {showClearAll ? (
          <Button type="button" size="sm" variant="outline" disabled={busy || count === 0} onClick={() => void clearAll()}>
            Clear All
          </Button>
        ) : null}
      </div>
      <div className="space-y-3">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            className={`w-full rounded-lg border p-3 text-left ${notification.isRead ? "border-[var(--border)] bg-white" : "border-[var(--foreground)] bg-[var(--surface-hover)]"}`}
            onClick={() => void markOne(notification.id)}
          >
            <p className="font-medium">{notification.title}</p>
            <p className="text-sm text-[var(--text-tertiary)]">{notification.message}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
