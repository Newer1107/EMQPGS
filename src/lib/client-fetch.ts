"use client";

import { CSRF_COOKIE } from "@/lib/constants";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split("=")[1] ?? "") : null;
}

async function ensureCsrfToken(): Promise<string | null> {
  try {
    let token = readCookie(CSRF_COOKIE);
    if (token) return token;

    const response = await fetch("/api/auth/csrf", { method: "GET", credentials: "same-origin" });
    if (!response.ok) return null;
    const result = await response.json();
    return result.data?.csrfToken ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch(input: string, init?: RequestInit) {
  try {
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers ?? {});

    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrfToken = await ensureCsrfToken();
      if (csrfToken) headers.set("x-csrf-token", csrfToken);
    }

    return await fetch(input, {
      ...init,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Network request failed. Please check your connection.");
  }
}
