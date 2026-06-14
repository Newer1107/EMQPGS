import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { ConflictError } from "@/lib/errors";
import { withOptimisticLock, buildOptimisticWhere, buildOptimisticUpdate } from "@/lib/optimistic-lock";
import { handleUniqueConstraint, withUniqueCheck } from "@/lib/db-helpers";

describe("buildOptimisticWhere", () => {
  it("returns { id, version } tuple", () => {
    expect(buildOptimisticWhere("abc-123", 3)).toEqual({ id: "abc-123", version: 3 });
  });
});

describe("buildOptimisticUpdate", () => {
  it("adds version increment to data", () => {
    expect(buildOptimisticUpdate({ status: "LOCKED" })).toEqual({
      status: "LOCKED",
      version: { increment: 1 },
    });
  });
});

describe("withOptimisticLock", () => {
  it("returns result on successful update", async () => {
    const result = await withOptimisticLock(() => Promise.resolve({ id: "abc" }));
    expect(result.id).toBe("abc");
  });

  it("throws ConflictError with 409 on P2025", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("n/a", {
      code: "P2025",
      clientVersion: "6.0.0",
    });
    let thrown: unknown;
    try {
      await withOptimisticLock(() => Promise.reject(err));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConflictError);
    expect((thrown as ConflictError).statusCode).toBe(409);
    expect((thrown as ConflictError).message).toContain("modified by another request");
  });

  it("re-throws non-P2025 errors", async () => {
    await expect(withOptimisticLock(() => Promise.reject(new Error("nope")))).rejects.toThrow("nope");
  });

  it("re-throws P2002 unique errors", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("n/a", {
      code: "P2002",
      clientVersion: "6.0.0",
    });
    await expect(withOptimisticLock(() => Promise.reject(err))).rejects.toThrow(err);
  });
});

describe("handleUniqueConstraint", () => {
  function makeP2002(target?: string[]) {
    return new Prisma.PrismaClientKnownRequestError("n/a", {
      code: "P2002",
      clientVersion: "6.0.0",
      meta: target ? { target } : undefined,
    });
  }

  it("returns ConflictError with known message", () => {
    let thrown: unknown;
    try {
      handleUniqueConstraint(makeP2002(), "Department_code_key");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConflictError);
    expect((thrown as ConflictError).message).toContain("department with this code");
  });

  it("uses generic message for unknown constraints", () => {
    let thrown: unknown;
    try {
      handleUniqueConstraint(makeP2002(["Some_random_key"]));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConflictError);
    expect((thrown as ConflictError).message).toContain("record already exists");
  });

  it("re-throws non-P2002 errors", () => {
    expect(() => handleUniqueConstraint(new Error("nope"))).toThrow("nope");
  });
});

describe("withUniqueCheck", () => {
  it("returns result on success", async () => {
    const r = await withUniqueCheck(() => Promise.resolve("ok"));
    expect(r).toBe("ok");
  });

  it("throws ConflictError on P2002", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("n/a", {
      code: "P2002",
      clientVersion: "6.0.0",
    });
    let thrown: unknown;
    try {
      await withUniqueCheck(() => Promise.reject(err), "Department_code_key");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConflictError);
    expect((thrown as ConflictError).statusCode).toBe(409);
  });

  it("re-throws non-P2002 errors", async () => {
    await expect(withUniqueCheck(() => Promise.reject(new Error("nope")))).rejects.toThrow("nope");
  });
});
