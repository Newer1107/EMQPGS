import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionBankPhase, QuestionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ReadinessEngine } from "@/modules/readiness/engine";

vi.mock("@/lib/db", () => ({ prisma: { questionBank: { findUnique: vi.fn() } } }));

function bank(status: QuestionStatus) {
  return {
    phase: "MODERATION", pattern: { totalSlots: 2 },
    slots: [{ assignedQuestion: { status, moderationEvents: [{ action: "QUESTION_APPROVED" }], coMapping: "CO1", rbtLevel: "REMEMBER" } }],
    aiReports: [{ status: "COMPLETED" }],
  };
}

describe("approval readiness uses current question state", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([QuestionStatus.REVISION_REQUESTED, QuestionStatus.REVISION_SUBMITTED])("blocks %s despite an earlier decision", async (status) => {
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(bank(status) as never);
    const result = await new ReadinessEngine().isReady("bank", QuestionBankPhase.APPROVAL);
    expect(result.ready).toBe(false);
    expect(result.issues).toContainEqual(expect.stringContaining("unresolved revisions"));
  });
  it.each([QuestionStatus.DRAFT, QuestionStatus.PENDING])("blocks undecided current version %s", async (status) => {
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(bank(status) as never);
    expect((await new ReadinessEngine().isReady("bank", QuestionBankPhase.APPROVAL)).ready).toBe(false);
  });
  it("allows terminal moderation decisions and leaves sparse coverage as warnings", async () => {
    for (const status of [QuestionStatus.APPROVED, QuestionStatus.REJECTED]) {
      vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(bank(status) as never);
      const result = await new ReadinessEngine().isReady("bank", QuestionBankPhase.APPROVAL);
      expect(result.ready).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
  it("still requires an AI report and moderation evidence", async () => {
    const record = bank(QuestionStatus.APPROVED);
    record.aiReports = [];
    record.slots[0].assignedQuestion.moderationEvents = [];
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(record as never);
    const result = await new ReadinessEngine().isReady("bank", QuestionBankPhase.APPROVAL);
    expect(result.issues).toHaveLength(2);
  });
  it("permits partially filled banks to enter moderation", async () => {
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(bank(QuestionStatus.PENDING) as never);
    const result = await new ReadinessEngine().isReady("bank", QuestionBankPhase.MODERATION);
    expect(result.ready).toBe(true);
    expect(result.warnings[0]).toContain("1 of 2 slots are empty");
  });
});
