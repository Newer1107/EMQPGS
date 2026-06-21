import { describe, it, expect, vi } from "vitest";
import { QuestionLibraryService } from "@/modules/question-library/service";

const actorId = "user-1";
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
}));

describe("QuestionLibraryService.transferOwnership", () => {
  it("throws when target user does not exist", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const service = new QuestionLibraryService();
    await expect(
      service.transferOwnership("q-1", "nonexistent-user", "reason", { userId: actorId }),
    ).rejects.toThrow("Target user not found");
  });

  it("throws when target user is disabled", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "disabled-user", status: "DISABLED" } as any);

    const service = new QuestionLibraryService();
    await expect(
      service.transferOwnership("q-1", "disabled-user", "reason", { userId: actorId }),
    ).rejects.toThrow("disabled user");
  });

  it("succeeds when target user is active", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "contrib-user", status: "ACTIVE" } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));
    vi.mocked(prisma.questionLibraryItem.update).mockResolvedValue({ id: "q-1", ownerId: "contrib-user" } as any);

    const service = new QuestionLibraryService();
    const result = await service.transferOwnership("q-1", "contrib-user", "reason", { userId: actorId });
    expect(result.ownerId).toBe("contrib-user");
  });

  it("creates QuestionOwnershipHistory on transfer", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "new-owner", status: "ACTIVE" } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));

    const service = new QuestionLibraryService();
    await service.transferOwnership("q-1", "new-owner", "Reassigning", { userId: actorId });
    expect(prisma.questionOwnershipHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toUserId: "new-owner", transferredById: actorId }),
      }),
    );
  });
});
