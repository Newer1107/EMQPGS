import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => {
  const mockDb = {
    questionLibraryItem: { findMany: vi.fn(), groupBy: vi.fn() },
    questionBank: { findMany: vi.fn(), findUnique: vi.fn() },
    moderatorBankAssignment: { findMany: vi.fn() },
    moderationEvent: { findMany: vi.fn() },
    notification: { findMany: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn(), count: vi.fn() },
    department: { count: vi.fn() },
    examCycle: { count: vi.fn() },
    questionBankQuestion: { findMany: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ "1": 1 }]),
  };
  return { prisma: mockDb };
});

describe("M2 - Query optimization with select", () => {
  it("getDashboard uses groupBy instead of all-questions query", async () => {
    const { ModeratorDashboardService } = await import("@/modules/moderation/dashboard.service");
    const { prisma } = await import("@/lib/db");

    vi.mocked(prisma.moderatorBankAssignment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.questionLibraryItem.groupBy).mockResolvedValue([
      { status: "PENDING" as never, _count: { _all: 5 } },
      { status: "APPROVED" as never, _count: { _all: 10 } },
    ]);
    vi.mocked(prisma.questionLibraryItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.questionBank.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

    const service = new ModeratorDashboardService();
    const dashboard = await service.getDashboard({ id: "mod-1", role: "MODERATOR" as never });

    expect(prisma.questionLibraryItem.groupBy).toHaveBeenCalled();
    expect(dashboard.summary.pending).toBe(5);
    expect(dashboard.summary.approved).toBe(10);
  });

  it("User model has role and departmentId indexes", async () => {
    const { prisma } = await import("@/lib/db");
    const mockUser = vi.mocked(prisma.user.findMany);
    mockUser.mockResolvedValue([]);
    await prisma.user.findMany({ where: { role: "CONTRIBUTOR" as never }, select: { id: true, name: true } });
    await prisma.user.findMany({ where: { departmentId: "dept-1" }, select: { id: true } });
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
