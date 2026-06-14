import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { ConflictError } from "@/lib/errors";
import { handleUniqueConstraint, withUniqueCheck } from "@/lib/db-helpers";

describe("handleUniqueConstraint", () => {
  function makeP2002(target?: string[]) {
    return new Prisma.PrismaClientKnownRequestError(
      "Unique constraint violation",
      {
        code: "P2002",
        clientVersion: "6.0.0",
        meta: target ? { target: target } : undefined,
      },
    );
  }

  it("throws ConflictError for P2002 with known constraint name", () => {
    expect(() =>
      handleUniqueConstraint(makeP2002(), "Department_code_key"),
    ).toThrow(ConflictError);
  });

  it("uses specific message for known constraints", () => {
    expect(() =>
      handleUniqueConstraint(makeP2002(), "Department_code_key"),
    ).toThrow(/department with this code already exists/);
  });

  it("uses generic message for unknown constraints", () => {
    expect(() =>
      handleUniqueConstraint(makeP2002(["Some_random_key"])),
    ).toThrow(/record already exists/);
  });

  it("re-throws non-P2002 errors", () => {
    const regularError = new Error("Something went wrong");
    expect(() => handleUniqueConstraint(regularError)).toThrow(
      "Something went wrong",
    );
  });

  it("re-throws other Prisma errors", () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Record not found",
      { code: "P2025", clientVersion: "6.0.0" },
    );
    expect(() => handleUniqueConstraint(prismaError)).toThrow(prismaError);
  });
});

describe("withUniqueCheck", () => {
  it("returns result on success", async () => {
    const result = await withUniqueCheck(() =>
      Promise.resolve({ id: "abc", code: "CSE" }),
    );
    expect(result).toEqual({ id: "abc", code: "CSE" });
  });

  it("throws ConflictError on P2002", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint",
      { code: "P2002", clientVersion: "6.0.0" },
    );

    await expect(
      withUniqueCheck(() => Promise.reject(prismaError), "Department_code_key"),
    ).rejects.toThrow(ConflictError);
  });

  it("re-throws non-P2002 errors", async () => {
    await expect(
      withUniqueCheck(() => Promise.reject(new Error("DB error"))),
    ).rejects.toThrow("DB error");
  });
});
