import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuestionStatus } from "@prisma/client";
import { QuestionLibraryService } from "@/modules/question-library/service";

const baseQuestion = {
  id: "q-1",
  ownerId: "contrib-1",
  subjectVersionId: "sv-1",
  moduleNumber: 1,
  marks: 2,
  questionText: "Test?",
  coMapping: "CO1",
  rbtLevel: "L1",
  createdById: "contrib-1",
};

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    questionLibraryItem: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    questionSlot: { findFirst: vi.fn() },
    questionRevision: { count: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prisma: mockPrisma };
});

vi.mock("@/lib/errors", () => {
  const AppError = class AppError extends Error {
    constructor(
      m: string,
      public statusCode = 400,
      public code = "APP_ERROR",
      public details?: unknown,
    ) {
      super(m);
    }
  };
  const ForbiddenError = class ForbiddenError extends AppError {
    constructor(m = "Forbidden") {
      super(m, 403, "FORBIDDEN");
    }
  };
  const NotFoundError = class NotFoundError extends AppError {
    constructor(m = "Resource not found") {
      super(m, 404, "NOT_FOUND");
    }
  };
  const ConflictError = class ConflictError extends AppError {
    constructor(m = "Conflict") {
      super(m, 409, "CONFLICT");
    }
  };
  return { AppError, ForbiddenError, NotFoundError, ConflictError };
});

vi.mock("@/modules/question-banks/mutable-guard", () => ({
  ensureQuestionBankMutable: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  QuestionStatus: {
    DRAFT: "DRAFT",
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    REVISION_REQUESTED: "REVISION_REQUESTED",
    REVISION_SUBMITTED: "REVISION_SUBMITTED",
  },
  RecordStatus: { LOCKED: "LOCKED" },
  Role: { COORDINATOR: "COORDINATOR", CONTRIBUTOR: "CONTRIBUTOR" },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, opts: { code: string }) {
        super(message);
        this.code = opts.code;
      }
    },
  },
}));

import { prisma } from "@/lib/db";

const contributor = { userId: "contrib-1" };
const coordinator = { userId: "coord-1", isCoordinator: true };

function setupQuestion(status: string) {
  vi.mocked(prisma.questionLibraryItem.findUnique).mockResolvedValue({
    ...baseQuestion,
    status,
  } as any);
}

describe("Moderation Bypass Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.questionSlot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.questionLibraryItem.update).mockResolvedValue({ ...baseQuestion } as any);
  });

  it("1. allows editing DRAFT questions", async () => {
    setupQuestion(QuestionStatus.DRAFT);
    vi.mocked(prisma.questionRevision.count).mockResolvedValue(0);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));

    const service = new QuestionLibraryService();
    const result = await service.update("q-1", { questionText: "Updated?" }, contributor);

    expect(result).toBeDefined();
  });

  it("2. blocks editing PENDING questions", async () => {
    setupQuestion(QuestionStatus.PENDING);

    const service = new QuestionLibraryService();
    await expect(
      service.update("q-1", { questionText: "Updated?" }, contributor),
    ).rejects.toThrow("Question cannot be edited in its current status.");
  });

  it("3. blocks editing REJECTED questions", async () => {
    setupQuestion(QuestionStatus.REJECTED);

    const service = new QuestionLibraryService();
    await expect(
      service.update("q-1", { questionText: "Updated?" }, contributor),
    ).rejects.toThrow("Question cannot be edited in its current status.");
  });

  it("4. blocks editing REVISION_SUBMITTED questions", async () => {
    setupQuestion(QuestionStatus.REVISION_SUBMITTED);

    const service = new QuestionLibraryService();
    await expect(
      service.update("q-1", { questionText: "Updated?" }, contributor),
    ).rejects.toThrow("Question cannot be edited in its current status.");
  });

  it("5. auto-reverts APPROVED questions to REVISION_REQUESTED when edited by coordinator", async () => {
    setupQuestion(QuestionStatus.APPROVED);
    vi.mocked(prisma.questionRevision.count).mockResolvedValue(0);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));

    const service = new QuestionLibraryService();
    await service.update("q-1", { questionText: "Updated?" }, coordinator);

    expect(vi.mocked(prisma.questionLibraryItem.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: QuestionStatus.REVISION_REQUESTED }),
      }),
    );
  });

  it("6. blocks editing APPROVED questions by non-coordinator", async () => {
    setupQuestion(QuestionStatus.APPROVED);

    const service = new QuestionLibraryService();
    await expect(
      service.update("q-1", { questionText: "Updated?" }, contributor),
    ).rejects.toThrow("Question cannot be edited in its current status.");
  });

  it("7. still calls ensureQuestionBankMutable when bank is LOCKED", async () => {
    setupQuestion(QuestionStatus.DRAFT);
    vi.mocked(prisma.questionSlot.findFirst).mockResolvedValue({
      questionBank: { recordStatus: "LOCKED" },
    } as any);
    vi.mocked(prisma.questionRevision.count).mockResolvedValue(0);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));

    const { ensureQuestionBankMutable } = await import("@/modules/question-banks/mutable-guard");

    const service = new QuestionLibraryService();
    await service.update("q-1", { questionText: "Updated?" }, contributor);

    expect(ensureQuestionBankMutable).toHaveBeenCalled();
  });
});
