import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const { mockCookiesGet, mockHeadersGet } = vi.hoisted(() => ({
  mockCookiesGet: vi.fn(),
  mockHeadersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
  headers: vi.fn().mockResolvedValue({ get: mockHeadersGet }),
}));

import { assertCsrfProtection } from "@/lib/csrf";
import { env } from "@/lib/env";
import { ForbiddenError } from "@/lib/errors";

describe("H1 — CSRF timingSafeEqual handles length mismatch", () => {
  beforeEach(() => {
    mockCookiesGet.mockReset();
    mockHeadersGet.mockReset();
  });

  it("returns ForbiddenError (not crash) for mismatched signature length", async () => {
    const malformedToken = "short.xx";
    mockCookiesGet.mockReturnValue({ value: malformedToken });
    mockHeadersGet.mockImplementation((name: string) => {
      if (name === "x-csrf-token") return malformedToken;
      if (name === "origin") return "http://localhost:3000";
      if (name === "host") return "localhost:3000";
      return null;
    });

    await expect(assertCsrfProtection("POST")).rejects.toThrow(ForbiddenError);
  });

  it("accepts a properly signed token", async () => {
    const raw = crypto.randomBytes(24).toString("hex");
    const timestamp = Date.now().toString(36);
    const signature = crypto.createHmac("sha256", env.CSRF_SECRET).update(`${raw}.${timestamp}`).digest("hex");
    const validToken = `${raw}.${timestamp}.${signature}`;
    mockCookiesGet.mockReturnValue({ value: validToken });
    mockHeadersGet.mockImplementation((name: string) => {
      if (name === "x-csrf-token") return validToken;
      if (name === "origin") return "http://localhost:3000";
      if (name === "host") return "localhost:3000";
      return null;
    });

    await expect(assertCsrfProtection("POST")).resolves.toBeUndefined();
  });

  it("does not throw for safe HTTP methods", async () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      await expect(assertCsrfProtection(method)).resolves.toBeUndefined();
    }
  });
});
