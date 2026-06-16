import { describe, it, expect, vi } from "vitest";
import { QuestionLibraryService } from "@/modules/question-library/service";
import { Role } from "@prisma/client";

const mockActor = { id: "user-1", role: Role.COORDINATOR, email: "coord@test.com", name: "Coordinator" };
const mockQuestion = { id: "q-1", ownerId: "old-owner", subjectVersionId: "sv-1", moduleNumber: 1, marks: 2, questionText: "Test?", coMapping: "CO1", rbtLevel: "L1", status: "DRAFT" };

vi.mock("@/lib/db", () => ({
  prisma: {
    questionLibraryItem: { findUnique: vi.fn(), update: vi.fn() },
    questionSlot: { findFirst: vi.fn() },
    questionRevision: { count: vi.fn(), create: vi.fn() },
    questionOwnershipHistory: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/errors", () => ({
  AppError: class AppError extends Error { constructor(m: string, public statusCode = 400) { super(m); } },
  ForbiddenError: class ForbiddenError extends Error { statusCode = 403; },
  NotFoundError: class NotFoundError extends Error { statusCode = 404; },
  ConflictError: class ConflictError extends Error { statusCode = 409; },
}));

vi.mock("@/modules/question-banks/mutable-guard", () => ({
  ensureQuestionBankMutable: vi.fn(),
}));

vi.mock("@/modules/question-library/repository", () => ({
  QuestionLibraryRepository: vi.fn().mockImplementation(() => ({
    findById: () => Promise.resolve(mockQuestion),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    findByBank: vi.fn(),
    findBySubjectVersion: vi.fn(),
    search: vi.fn(),
  })),
}));

vi.mock("@prisma/client", () => ({
  QuestionStatus: { DRAFT: "DRAFT", PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED", REVISION_REQUESTED: "REVISION_REQUESTED", REVISION_SUBMITTED: "REVISION_SUBMITTED" },
  Role: { COORDINATOR: "COORDINATOR", CONTRIBUTOR: "CONTRIBUTOR" },
}));

describe("QuestionLibraryService.transferOwnership", () => {
  it("throws when target user does not exist", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const service = new QuestionLibraryService();
    await expect(
      service.transferOwnership("q-1", "nonexistent-user", "reason", mockActor),
    ).rejects.toThrow("Target user not found");
  });

  it("throws when target user is disabled", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "disabled-user", status: "DISABLED", role: "CONTRIBUTOR" });

    const service = new QuestionLibraryService();
    await expect(
      service.transferOwnership("q-1", "disabled-user", "reason", mockActor),
    ).rejects.toThrow("disabled user");
  });

  it("throws when target user is not a CONTRIBUTOR", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "coord-user", status: "ACTIVE", role: "COORDINATOR" });

    const service = new QuestionLibraryService();
    await expect(
      service.transferOwnership("q-1", "coord-user", "reason", mockActor),
    ).rejects.toThrow("contributors");
  });

  it("succeeds when target user is a valid contributor", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "contrib-user", status: "ACTIVE", role: "CONTRIBUTOR" });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));
    vi.mocked(prisma.questionLibraryItem.update).mockResolvedValue({ id: "q-1", ownerId: "contrib-user" });

    const service = new QuestionLibraryService();
    const result = await service.transferOwnership("q-1", "contrib-user", "reason", mockActor);
    expect(result.ownerId).toBe("contrib-user");
  });
});
