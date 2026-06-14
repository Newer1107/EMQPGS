import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { AssignmentService } from "@/modules/assignments/service";
import { AppError, NotFoundError } from "@/lib/errors";

vi.mock("@/lib/db", () => ({
  prisma: {
    questionBank: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    moderatorBankAssignment: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

const mockNotificationService = {
  create: vi.fn().mockResolvedValue({}),
};

describe("M7/N10 — Moderator assignment API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a ModeratorBankAssignment for a valid moderator", async () => {
    (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "bank-1",
      subject: { subjectCode: "CS501", subjectName: "Algorithms" },
    });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "mod-1",
      role: Role.MODERATOR,
    });
    (prisma.moderatorBankAssignment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.moderatorBankAssignment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "mba-1",
      moderatorId: "mod-1",
      questionBankId: "bank-1",
      moderator: { id: "mod-1", name: "Mod One", email: "mod@test.com" },
      questionBank: { subject: { subjectCode: "CS501", subjectName: "Algorithms" } },
    });

    const service = new AssignmentService(undefined as never, mockNotificationService as never);
    const result = await service.assignModerator("bank-1", "mod-1");

    expect(result).toHaveProperty("id", "mba-1");
    expect(result).toHaveProperty("moderatorId", "mod-1");
    expect(prisma.moderatorBankAssignment.create).toHaveBeenCalledWith({
      data: { moderatorId: "mod-1", questionBankId: "bank-1" },
      include: { moderator: true, questionBank: { include: { subject: true } } },
    });
  });

  it("throws 404 when question bank does not exist", async () => {
    (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const service = new AssignmentService(undefined as never, mockNotificationService as never);
    await expect(service.assignModerator("missing-bank", "mod-1", "coord-1")).rejects.toThrow(NotFoundError);
  });

  it("throws 404 when moderator does not exist", async () => {
    (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "bank-1", subject: {} });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const service = new AssignmentService(undefined as never, mockNotificationService as never);
    await expect(service.assignModerator("bank-1", "missing-mod", "coord-1")).rejects.toThrow(NotFoundError);
  });

  it("throws 400 when user is not a MODERATOR role", async () => {
    (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "bank-1", subject: {} });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "contrib-1", role: Role.CONTRIBUTOR });

    const service = new AssignmentService(undefined as never, mockNotificationService as never);
    await expect(service.assignModerator("bank-1", "contrib-1", "coord-1")).rejects.toThrow(AppError);
  });

  it("throws 409 when moderator is already assigned", async () => {
    (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "bank-1", subject: {} });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "mod-1", role: Role.MODERATOR });
    (prisma.moderatorBankAssignment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing-mba" });

    const service = new AssignmentService(undefined as never, mockNotificationService as never);
    await expect(service.assignModerator("bank-1", "mod-1")).rejects.toThrow(AppError);
  });

  it("sends a notification to the assigned moderator", async () => {
    (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "bank-1",
      subject: { subjectCode: "CS501", subjectName: "Algorithms" },
    });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "mod-1",
      role: Role.MODERATOR,
    });
    (prisma.moderatorBankAssignment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.moderatorBankAssignment.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "mba-1" });

    const service = new AssignmentService(undefined as never, mockNotificationService as never);
    await service.assignModerator("bank-1", "mod-1");

    expect(mockNotificationService.create).toHaveBeenCalledWith(
      "mod-1",
      expect.stringContaining("moderator"),
      expect.stringContaining("Algorithms"),
      expect.any(String),
      expect.any(String),
    );
  });
});
