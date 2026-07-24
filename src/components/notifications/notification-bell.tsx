"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-fetch";
import { Bell } from "lucide-react";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

const POLL_INTERVAL = 30_000;

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchUnread() {
      try {
        const res = await apiFetch("/api/notifications?limit=5");
        const body = await res.json();
        if (!cancelled && body.success) {
          const data = body.data;
          setUnread(data.unreadCount ?? 0);
          setItems((data.notifications ?? []).slice(0, 5));
        }
      } catch { /* ignore */ }
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markRead(id: string) {
    setLoading(true);
    try {
      const res = await apiFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [id] }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        setUnread((prev) => Math.max(0, prev - 1));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="relative flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-hover)]"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <Link href="/notifications" className="text-xs font-medium text-[var(--accent)]" onClick={() => setOpen(false)}>
              View all
            </Link>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">No notifications</p>
            ) : items.map((n) => (
              <div key={n.id} className={`flex items-start gap-3 border-b border-[var(--border)] px-4 py-3 ${n.isRead ? "" : "bg-[var(--accent)]/5"}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)] line-clamp-2">{n.message}</p>
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
                {!n.isRead && (
                  <button type="button" className="shrink-0 text-[10px] font-medium text-[var(--accent)] hover:underline disabled:opacity-50" onClick={() => markRead(n.id)} disabled={loading}>
                    Read
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
