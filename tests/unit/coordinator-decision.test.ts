import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoordinatorDecision, QuestionBankStatus, Role } from "@prisma/client";
import { ReportService } from "@/modules/reports/service";
import { ForbiddenError, NotFoundError, AppError } from "@/lib/errors";

vi.mock("@/lib/db", () => ({
  prisma: {
    questionBank: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

import { prisma } from "@/lib/db";

function makeService() {
  return new ReportService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

const mockActor = { id: "coord-1", role: Role.COORDINATOR, email: "coord@test.com", name: "Coordinator" };

describe("C4 — coordinatorDecision does not silently lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("APPROVED transitions to APPROVED status (not LOCKED)", async () => {
    (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "bank-1",
      status: QuestionBankStatus.AWAITING_COORDINATOR_APPROVAL,
    });
    (prisma.questionBank.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "bank-1",
      status: QuestionBankStatus.APPROVED,
    });

    const service = makeService();
    const result = await service.coordinatorDecision("bank-1", CoordinatorDecision.APPROVED, "Looks good", mockActor);

    expect(prisma.questionBank.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: QuestionBankStatus.APPROVED,
          coordinatorDecision: CoordinatorDecision.APPROVED,
          lockedAt: null,
        }),
      }),
    );
    expect(result.status).toBe(QuestionBankStatus.APPROVED);
  });

  it("REJECTED transitions to AWAITING_HOD_SIGN", async () => {
    (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "bank-1",
      status: QuestionBankStatus.AWAITING_COORDINATOR_APPROVAL,
    });
    (prisma.questionBank.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "bank-1",
      status: QuestionBankStatus.AWAITING_HOD_SIGN,
    });

    const service = makeService();
    const result = await service.coordinatorDecision("bank-1", CoordinatorDecision.REJECTED, "Needs changes", mockActor);

    expect(prisma.questionBank.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: QuestionBankStatus.AWAITING_HOD_SIGN,
          coordinatorDecision: CoordinatorDecision.REJECTED,
          lockedAt: null,
        }),
      }),
    );
    expect(result.status).toBe(QuestionBankStatus.AWAITING_HOD_SIGN);
  });

  it("throws ForbiddenError for non-coordinator actors", async () => {
    const service = makeService();
    await expect(
      service.coordinatorDecision("bank-1", CoordinatorDecision.APPROVED, "test", { ...mockActor, role: Role.MODERATOR }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError for missing question bank", async () => {
    (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const service = makeService();
    await expect(
      service.coordinatorDecision("bank-1", CoordinatorDecision.APPROVED, "test", mockActor),
    ).rejects.toThrow(NotFoundError);
  });

  it("never sets lockedAt to a non-null value", async () => {
    (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "bank-1",
      status: QuestionBankStatus.AWAITING_COORDINATOR_APPROVAL,
    });
    (prisma.questionBank.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const service = makeService();
    await service.coordinatorDecision("bank-1", CoordinatorDecision.APPROVED, "ok", mockActor);

    const updateCall = (prisma.questionBank.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall.data.lockedAt).toBeNull();
  });
});
