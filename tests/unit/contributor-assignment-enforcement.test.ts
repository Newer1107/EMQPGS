import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";
import { QuestionLibraryService } from "@/modules/question-library/service";
import { QuestionSlotService } from "@/modules/question-slots/service";

vi.mock("@/lib/db", () => ({
  prisma: {
    contributorBankAssignment: { findUnique: vi.fn() },
    questionLibraryItem: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    questionSlot: { findFirst: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    questionRevision: { create: vi.fn(), count: vi.fn() },
    questionBank: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/errors", () => ({
  AppError: class AppError extends Error {
    constructor(m: string, public statusCode = 400) {
      super(m);
    }
  },
  NotFoundError: class NotFoundError extends Error {
    statusCode = 404;
    constructor(m = "Not found") {
      super(m);
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(m: string) {
      super(m);
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    statusCode = 403;
  },
}));

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
  RecordStatus: { LOCKED: "LOCKED", ACTIVE: "ACTIVE" },
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

const contributor = { id: "contrib-1", role: "CONTRIBUTOR", name: "Alice", email: "alice@test.com" } as any;
const coordinator = { id: "coord-1", role: "COORDINATOR", name: "Coord", email: "coord@test.com" } as any;
const bankId = "bank-1";
const slotId = "slot-1";
const questionId = "q-1";

const baseInput = {
  subjectVersionId: "sv-1",
  moduleNumber: 1,
  marks: 2,
  questionText: "Test?",
  coMapping: "CO1" as const,
  rbtLevel: "L1" as const,
  difficultyLevel: "EASY" as const,
};

const mockSlot = {
  id: slotId,
  questionBankId: bankId,
  moduleNumber: 1,
  marks: 2,
  slotNumber: 1,
  assignedQuestionId: null,
  reservedById: null,
  reservedAt: null,
  isLocked: false,
  assignedQuestion: null,
  questionBank: { id: bankId, subject: { subjectName: "Test" } },
};

const mockBank = { id: bankId, recordStatus: "ACTIVE" } as any;
const mockQuestion = { id: questionId, ownerId: contributor.id };

function setupCreateForBankMocks() {
  vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));
  vi.mocked(prisma.questionLibraryItem.create).mockResolvedValue(mockQuestion as any);
  vi.mocked(prisma.questionRevision.count).mockResolvedValue(0);
  vi.mocked(prisma.questionRevision.create).mockResolvedValue({} as any);
  vi.mocked(prisma.questionSlot.findFirst).mockResolvedValue(null);
}

function setupAssignToSlotMocks() {
  vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(mockBank);
  vi.mocked(prisma.questionLibraryItem.findUnique).mockResolvedValue(mockQuestion as any);
  vi.mocked(prisma.questionSlot.findUnique).mockResolvedValue(mockSlot);
  vi.mocked(prisma.questionSlot.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.questionSlot.update).mockResolvedValue({ id: slotId, assignedQuestionId: questionId } as any);
}

describe("Model B — Contributor Assignment Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createForBank", () => {
    it("allows assigned contributor to create question", async () => {
      vi.mocked(prisma.contributorBankAssignment.findUnique).mockResolvedValue({ id: "assn-1" } as any);
      setupCreateForBankMocks();

      const service = new QuestionLibraryService();
      const result = await service.createForBank({ ...baseInput, questionBankId: bankId }, contributor);
      expect(result).toBeDefined();
      expect(prisma.contributorBankAssignment.findUnique).toHaveBeenCalledWith({
        where: { contributorId_questionBankId: { contributorId: contributor.id, questionBankId: bankId } },
      });
    });

    it("blocks unassigned contributor with 403", async () => {
      vi.mocked(prisma.contributorBankAssignment.findUnique).mockResolvedValue(null);

      const service = new QuestionLibraryService();
      await expect(
        service.createForBank({ ...baseInput, questionBankId: bankId }, contributor)
      ).rejects.toThrow(AppError);
      await expect(
        service.createForBank({ ...baseInput, questionBankId: bankId }, contributor)
      ).rejects.toThrow("You are no longer assigned to contribute to this question bank.");
    });

    it("allows coordinator to bypass assignment check", async () => {
      setupCreateForBankMocks();

      const service = new QuestionLibraryService();
      const result = await service.createForBank({ ...baseInput, questionBankId: bankId }, coordinator);
      expect(result).toBeDefined();
      expect(prisma.contributorBankAssignment.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("assignToSlot", () => {
    it("allows assigned contributor to assign to slot", async () => {
      vi.mocked(prisma.contributorBankAssignment.findUnique).mockResolvedValue({ id: "assn-1" } as any);
      setupAssignToSlotMocks();

      const service = new QuestionSlotService();
      const result = await service.assignToSlot(slotId, questionId, contributor);
      expect(result).toBeDefined();
      expect(prisma.contributorBankAssignment.findUnique).toHaveBeenCalledWith({
        where: { contributorId_questionBankId: { contributorId: contributor.id, questionBankId: bankId } },
      });
    });

    it("blocks unassigned contributor with 403", async () => {
      vi.mocked(prisma.contributorBankAssignment.findUnique).mockResolvedValue(null);
      setupAssignToSlotMocks();

      const service = new QuestionSlotService();
      await expect(
        service.assignToSlot(slotId, questionId, contributor)
      ).rejects.toThrow(AppError);
      await expect(
        service.assignToSlot(slotId, questionId, contributor)
      ).rejects.toThrow("You are no longer assigned to contribute to this question bank.");
    });

    it("allows coordinator to bypass assignment check", async () => {
      setupAssignToSlotMocks();

      const service = new QuestionSlotService();
      const result = await service.assignToSlot(slotId, questionId, coordinator);
      expect(result).toBeDefined();
      expect(prisma.contributorBankAssignment.findUnique).not.toHaveBeenCalled();
    });
  });
});
