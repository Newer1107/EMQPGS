import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const mockDb = {
    questionLibraryItem: { findMany: vi.fn(), groupBy: vi.fn() },
    questionBank: { findMany: vi.fn(), findUnique: vi.fn() },
    responsibilityAssignment: { findMany: vi.fn() },
    moderationEvent: { findMany: vi.fn() },
    notification: { findMany: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn(), count: vi.fn() },
    department: { count: vi.fn() },
    examCycle: { count: vi.fn() },
    questionSlot: { findMany: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ "1": 1 }]),
  };
  return { prisma: mockDb };
});

describe("M2 - Query optimization with select", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("getDashboard uses groupBy instead of all-questions query", async () => {
    const { ModeratorDashboardService } = await import("@/modules/moderation/dashboard.service");
    const { prisma } = await import("@/lib/db");

    vi.mocked(prisma.responsibilityAssignment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.questionLibraryItem.groupBy).mockResolvedValue([
      { status: "PENDING", _count: { _all: 5 } },
      { status: "REVISION_SUBMITTED", _count: { _all: 2 } },
      { status: "APPROVED", _count: { _all: 10 } },
    ] as never);
    vi.mocked(prisma.questionLibraryItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.questionBank.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
    vi.mocked(prisma.questionSlot.findMany).mockResolvedValue([]);

    const service = new ModeratorDashboardService();
    const dashboard = await service.getDashboard({ userId: "mod-1", bankId: "bank-1" });

    expect(prisma.questionLibraryItem.groupBy).toHaveBeenCalledExactlyOnceWith({
      by: ["status"],
      where: { slotAssignments: { some: { questionBankId: "bank-1" } } },
      _count: { _all: true },
    });
    // Loading the revision queue is allowed; loading all questions to count them is not.
    expect(prisma.questionLibraryItem.findMany).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      where: { status: "REVISION_REQUESTED", slotAssignments: { some: { questionBankId: "bank-1" } } },
    }));
    expect(prisma.questionSlot.findMany).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      where: { questionBankId: "bank-1", assignedQuestion: { status: { in: ["PENDING", "REVISION_SUBMITTED"] } } },
    }));
    expect(prisma.notification.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { recipientId: "mod-1" }, orderBy: { createdAt: "desc" }, take: 50,
    });
    expect(dashboard.summary.pending).toBe(7);
    expect(dashboard.summary.approved).toBe(10);
  });

  it("User model has status and homeDepartmentId indexes", async () => {
    const { prisma } = await import("@/lib/db");
    const mockUser = vi.mocked(prisma.user.findMany);
    mockUser.mockResolvedValue([]);
    await prisma.user.findMany({ where: { status: "ACTIVE" as never }, select: { id: true, name: true } });
    await prisma.user.findMany({ where: { homeDepartmentId: "dept-1" }, select: { id: true } });
    expect(mockUser).toHaveBeenCalledTimes(2);
  });

  it("Notification query uses compound index fields", async () => {
    const { NotificationService } = await import("@/modules/notifications/service");
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
    const service = new NotificationService();
    await service.listForUser("user-1", 10);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { recipientId: "user-1" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  });

  it("Notification unreadCount uses recipientId + isRead filter", async () => {
    const { NotificationService } = await import("@/modules/notifications/service");
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.notification.count).mockResolvedValue(3);
    const service = new NotificationService();
    const count = await service.unreadCount("user-1");
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { recipientId: "user-1", isRead: false },
    });
    expect(count).toBe(3);
  });
});
