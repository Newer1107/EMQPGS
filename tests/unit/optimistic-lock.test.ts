import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ConflictError } from "@/lib/errors";
import {
  withOptimisticLock,
  buildOptimisticWhere,
  buildOptimisticUpdate,
} from "@/lib/optimistic-lock";

describe("buildOptimisticWhere", () => {
  it("returns { id, version } tuple", () => {
    const where = buildOptimisticWhere("abc-123", 3);
    expect(where).toEqual({ id: "abc-123", version: 3 });
  });
});

describe("buildOptimisticUpdate", () => {
  it("adds version increment to data", () => {
    const update = buildOptimisticUpdate({ status: "LOCKED" });
    expect(update).toEqual({
      status: "LOCKED",
      version: { increment: 1 },
    });
  });

  it("preserves all original fields", () => {
    const update = buildOptimisticUpdate({
      status: "IN_PROGRESS",
      lockedAt: new Date("2026-01-01"),
    });
    expect(update.status).toBe("IN_PROGRESS");
    expect(update.version).toEqual({ increment: 1 });
  });
});

describe("withOptimisticLock", () => {
  it("returns result on successful update", async () => {
    const result = await withOptimisticLock(
      () => Promise.resolve({ id: "abc", status: "LOCKED" }),
      "Question bank",
    );
    expect(result).toEqual({ id: "abc", status: "LOCKED" });
  });

  it("throws ConflictError on P2025", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Record not found",
      { code: "P2025", clientVersion: "6.0.0" },
    );

    await expect(
      withOptimisticLock(
        () => Promise.reject(prismaError),
        "Question bank",
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("includes entity name in ConflictError message", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Record not found",
      { code: "P2025", clientVersion: "6.0.0" },
    );

    await expect(
      withOptimisticLock(
        () => Promise.reject(prismaError),
        "Exam cycle",
      ),
    ).rejects.toThrow(/Exam cycle was modified/);
  });

  it("re-throws non-P2025 errors unchanged", async () => {
    const regularError = new Error("Network error");

    await expect(
      withOptimisticLock(() => Promise.reject(regularError)),
    ).rejects.toThrow("Network error");
  });

  it("re-throws other Prisma errors unchanged", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint violation",
      { code: "P2002", clientVersion: "6.0.0" },
    );

    await expect(
      withOptimisticLock(() => Promise.reject(prismaError)),
    ).rejects.toThrow(prismaError);
  });
});
