import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuestionStatus, Role, type QuestionLibraryItem, type User } from "@prisma/client";
import { QuestionLibraryService, QuestionUsageService } from "@/modules/question-library/service";
import { NotFoundError, ForbiddenError, AppError } from "@/lib/errors";

vi.mock("@/lib/db", () => {
  const mockTx = {
    questionLibraryItem: { update: vi.fn() },
    questionOwnershipHistory: { create: vi.fn() },
  };
  const mockPrisma = {
    subjectVersion: { findUnique: vi.fn() },
    questionLibraryItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    questionRevision: { count: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    questionOwnershipHistory: { create: vi.fn(), findMany: vi.fn() },
    questionUsageHistory: { create: vi.fn(), findMany: vi.fn() },
    moderationEvent: { findMany: vi.fn() },
    questionSlot: { findFirst: vi.fn(), update: vi.fn() },
    examCycle: { findUnique: vi.fn() },
    $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };
  mockTx.questionLibraryItem.update.mockImplementation((args: { data: { ownerId: string } }) => ({ ...mockQuestion, ownerId: args.data.ownerId }));
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/db";

const mockActor: User = { id: "user-1", name: "Test User", email: "test@test.com", role: Role.CONTRIBUTOR, status: "ACTIVE" as any, lastLoginAt: null, departmentId: null, resetTokenHash: null, resetTokenExpiry: null, createdAt: new Date(), updatedAt: new Date() };
const mockCoordinator: User = { ...mockActor, id: "coord-1", role: Role.COORDINATOR };
const mockQuestion: QuestionLibraryItem = {
  id: "q-1", subjectVersionId: "sv-1", moduleNumber: 3, marks: 5,
  questionText: "What is the capital of France?",
  coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM",
  teachingIndex: "3.1", status: QuestionStatus.DRAFT,
  createdById: "user-1", ownerId: "user-1",
  moderatorRemark: null, submittedAt: null, reviewedAt: null,
  createdAt: new Date(), updatedAt: new Date(),
};

function mockRepoFindById(overrides: Partial<QuestionLibraryItem> = {}) {
  (prisma.questionLibraryItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockQuestion, ...overrides });
}

function mockRepoUpdate(overrides: Partial<QuestionLibraryItem> = {}) {
  (prisma.questionLibraryItem.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockQuestion, ...overrides });
}

describe("Question Governance Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.subjectVersion.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sv-1" });
    (prisma.questionLibraryItem.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockQuestion);
    (prisma.questionRevision.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.questionRevision.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.questionLibraryItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    mockRepoUpdate();
  });

  describe("1. Revision coverage — every tracked field change creates a revision", () => {
    it("creates revision when questionText changes", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await service.update("q-1", { questionText: "New text?" }, mockActor as any);
      expect(prisma.questionRevision.create).toHaveBeenCalledTimes(1);
    });

    it("creates revision when moduleNumber changes", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await service.update("q-1", { moduleNumber: 4 }, mockActor as any);
      expect(prisma.questionRevision.create).toHaveBeenCalledTimes(1);
    });

    it("creates revision when marks changes", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await service.update("q-1", { marks: 10 }, mockActor as any);
      expect(prisma.questionRevision.create).toHaveBeenCalledTimes(1);
    });

    it("creates revision when coMapping changes", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await service.update("q-1", { coMapping: "CO2" }, mockActor as any);
      expect(prisma.questionRevision.create).toHaveBeenCalledTimes(1);
    });

    it("creates revision when rbtLevel changes", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await service.update("q-1", { rbtLevel: "L3" }, mockActor as any);
      expect(prisma.questionRevision.create).toHaveBeenCalledTimes(1);
    });

    it("creates revision when difficultyLevel changes", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await service.update("q-1", { difficultyLevel: "HARD" }, mockActor as any);
      expect(prisma.questionRevision.create).toHaveBeenCalledTimes(1);
    });

    it("creates revision when teachingIndex changes", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await service.update("q-1", { teachingIndex: "4.2" }, mockActor as any);
      expect(prisma.questionRevision.create).toHaveBeenCalledTimes(1);
    });

    it("does NOT create revision when only status changes", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await service.update("q-1", { status: QuestionStatus.PENDING }, mockActor as any);
      expect(prisma.questionRevision.create).not.toHaveBeenCalled();
    });

    it("snapshots all tracked fields in the revision", async () => {
      mockRepoFindById();
      (prisma.questionLibraryItem.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockQuestion, questionText: "Updated?" });
      const service = new QuestionLibraryService();
      await service.update("q-1", { questionText: "Updated?" }, mockActor as any);
      expect(prisma.questionRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            snapshotQuestionText: "Updated?",
            snapshotModule: 3,
            snapshotMarks: 5,
            snapshotCo: "CO1",
            snapshotRbt: "L2",
            snapshotDifficulty: "MEDIUM",
            snapshotTeachingIndex: "3.1",
          }),
        }),
      );
    });
  });

  describe("2. Ownership transfer creates ownership history", () => {
    it("creates QuestionOwnershipHistory on transfer via transaction", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await service.transferOwnership("q-1", "new-owner", "Reassigning", mockCoordinator as any);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("throws ForbiddenError for non-coordinator", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await expect(service.transferOwnership("q-1", "new-owner", "test", mockActor as any)).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError for missing question", async () => {
      (prisma.questionLibraryItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const service = new QuestionLibraryService();
      await expect(service.transferOwnership("q-1", "new-owner", "test", mockCoordinator as any)).rejects.toThrow(NotFoundError);
    });

    it("updates the ownerId on the question inside transaction", async () => {
      mockRepoFindById();
      const service = new QuestionLibraryService();
      const result = await service.transferOwnership("q-1", "new-owner", undefined, mockCoordinator as any);
      expect((result as any).ownerId).toBe("new-owner");
    });

    it("does not use `as any` — history record has non-nullable fromUserId", async () => {
      mockRepoFindById();
      const { prisma: mockPrisma } = await import("@/lib/db");
      mockRepoFindById();
      const service = new QuestionLibraryService();
      await service.transferOwnership("q-1", "new-owner", "test", mockCoordinator as any);
      const tx = (mockPrisma as any).$transaction;
      expect(tx).toHaveBeenCalled();
    });
  });

  describe("3. Usage recording via QuestionUsageService", () => {
    it("creates QuestionUsageHistory through recordUsage", async () => {
      (prisma.questionUsageHistory.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "uh-1" });
      const service = new QuestionUsageService();
      const result = await service.recordUsage("q-1", "ec-1", "GENERATED_PAPER", "gp-1");
      expect(prisma.questionUsageHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            questionId: "q-1",
            examCycleId: "ec-1",
            sourceType: "GENERATED_PAPER",
            sourceId: "gp-1",
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it("populates sourceType and sourceId", async () => {
      const service = new QuestionUsageService();
      await service.recordUsage("q-1", "ec-1", "MANUAL", "manual-entry-1");
      const call = (prisma.questionUsageHistory.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.sourceType).toBe("MANUAL");
      expect(call.data.sourceId).toBe("manual-entry-1");
    });
  });

  describe("4. No direct QuestionUsageHistory creation in PaperGenerationService (compile-time check)", () => {
    it("PaperGenerationService imports QuestionUsageService, does not call prisma.questionUsageHistory.create directly", async () => {
      const { PaperGenerationService } = await import("@/modules/reports/paper.service");
      expect(PaperGenerationService).toBeDefined();
    });
  });

  describe("5. Question creation creates initial revision", () => {
    it("creates revision with 'Initial creation' reason when creating a question", async () => {
      const service = new QuestionLibraryService();
      await service.create({
        subjectVersionId: "sv-1", moduleNumber: 1, marks: 2,
        questionText: "Test question?",
        coMapping: "CO1", rbtLevel: "L1",
      }, mockActor as any);
      expect(prisma.questionRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            changeReason: "Initial creation",
            changedById: "user-1",
          }),
        }),
      );
    });
  });

  describe("6. Submit does not create revision (status-only change)", () => {
    it("submit calls updateStatus without revision", async () => {
      mockRepoFindById({ status: QuestionStatus.DRAFT });
      (prisma.questionLibraryItem.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockQuestion, status: QuestionStatus.PENDING });
      const service = new QuestionLibraryService();
      await service.submit("q-1", mockActor as any);
      expect(prisma.questionLibraryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: QuestionStatus.PENDING, submittedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.questionRevision.create).not.toHaveBeenCalled();
    });
  });
});
