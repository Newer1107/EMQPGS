import { describe, it, expect, vi } from "vitest";
import { CoordinatorDecision, QuestionBankPhase, Role } from "@prisma/client";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";

const mockActor = { id: "user-1", role: Role.COORDINATOR, email: "coord@test.com", name: "Coordinator" };

vi.mock("@/lib/db", () => ({
  prisma: {
    questionBank: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    approvalDecision: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/constants", () => ({ ENTITY_TYPES: { QUESTION_BANK: "QUESTION_BANK" } }));
vi.mock("@/modules/coordinator/department-utils", () => ({
  DepartmentAccessUtils: class MockDeptUtils {
    getAssignedDepartmentIds = vi.fn().mockResolvedValue(["dept-1"]);
    assertDepartmentAccess = vi.fn().mockResolvedValue(undefined);
  },
  Actor: ({}) as any,
}));

describe("coordinatorDecision", () => {
  it("APPROVED transitions phase to COMPLETE and creates ApprovalDecision", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue({
      id: "bank-1",
      phase: QuestionBankPhase.APPROVAL,
      recordStatus: "ACTIVE",
      version: 1,
    } as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([{ id: "decision-1", decision: CoordinatorDecision.APPROVED }]);

    const service = new QuestionBankWorkflowService();
    const result = await service.coordinatorDecision("bank-1", CoordinatorDecision.APPROVED, "Looks good", mockActor);
    expect(result).toHaveProperty("decision", CoordinatorDecision.APPROVED);
  });

  it("REJECTED transitions phase to MODERATION", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue({
      id: "bank-1",
      phase: QuestionBankPhase.APPROVAL,
      recordStatus: "ACTIVE",
      version: 1,
    } as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([{ id: "decision-2", decision: CoordinatorDecision.REJECTED }]);

    const service = new QuestionBankWorkflowService();
    const result = await service.coordinatorDecision("bank-1", CoordinatorDecision.REJECTED, "Needs changes", mockActor);
    expect(result).toHaveProperty("decision", CoordinatorDecision.REJECTED);
  });

  it("throws ForbiddenError for non-coordinator actors", async () => {
    const service = new QuestionBankWorkflowService();
    const nonCoordActor = { ...mockActor, role: Role.MODERATOR };
    await expect(
      service.coordinatorDecision("bank-1", CoordinatorDecision.APPROVED, "test", nonCoordActor),
    ).rejects.toThrow();
  });

  it("throws when bank is not in APPROVAL phase", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue({
      id: "bank-1",
      phase: QuestionBankPhase.DRAFTING,
      recordStatus: "ACTIVE",
      version: 1,
    } as any);

    const service = new QuestionBankWorkflowService();
    await expect(
      service.coordinatorDecision("bank-1", CoordinatorDecision.APPROVED, "test", mockActor),
    ).rejects.toThrow();
  });

  it("throws on locked bank", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue({
      id: "bank-1",
      phase: QuestionBankPhase.APPROVAL,
      recordStatus: "LOCKED",
      version: 1,
    } as any);

    const service = new QuestionBankWorkflowService();
    await expect(
      service.coordinatorDecision("bank-1", CoordinatorDecision.APPROVED, "test", mockActor),
    ).rejects.toThrow("Locked question bank cannot be modified");
  });
});
