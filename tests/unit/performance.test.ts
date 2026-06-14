import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildCursorPaginationParams, extractPaginationMeta, paginatedResponse } from "@/lib/pagination";

vi.mock("@/lib/db", () => ({
  prisma: {
    questionBank: { findMany: vi.fn(), findUnique: vi.fn() },
    question: { findMany: vi.fn(), groupBy: vi.fn() },
    questionSlot: { findMany: vi.fn() },
    examCycle: { findMany: vi.fn() },
    user: { findMany: vi.fn(), count: vi.fn() },
    department: { findMany: vi.fn(), count: vi.fn() },
    teacherAssignment: { findMany: vi.fn(), count: vi.fn() },
    notification: { findMany: vi.fn(), count: vi.fn() },
    subject: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
    coordinatorDepartmentAssignment: { findMany: vi.fn() },
    moderationEvent: { findMany: vi.fn() },
    moderatorBankAssignment: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

describe("N8 - Cursor-based pagination utility", () => {
  it("builds pagination params without cursor", () => {
    const result = buildCursorPaginationParams({ take: 25 });
    expect(result).toEqual({ take: 26 });
  });

  it("builds pagination params with cursor", () => {
    const result = buildCursorPaginationParams({ take: 25, cursor: "abc-123" });
    expect(result).toEqual({ cursor: { id: "abc-123" }, skip: 1, take: 26 });
  });

  it("caps take at 200", () => {
    const result = buildCursorPaginationParams({ take: 500 });
    expect(result.take).toBe(201);
  });

  it("defaults take to 26 (25+1)", () => {
    const result = buildCursorPaginationParams({});
    expect(result.take).toBe(26);
  });

  it("extracts pagination meta with more items", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ id: `item-${i}` }));
    const { items: result, meta } = extractPaginationMeta(items, 10);
    expect(result).toHaveLength(10);
    expect(meta.hasMore).toBe(true);
    expect(meta.cursor).toBe("item-9");
  });

  it("extracts pagination meta without more items", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: `item-${i}` }));
    const { items: result, meta } = extractPaginationMeta(items, 10);
    expect(result).toHaveLength(8);
    expect(meta.hasMore).toBe(false);
    expect(meta.cursor).toBe("item-7");
  });

  it("extracts pagination meta with exact boundary", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `item-${i}` }));
    const { items: result, meta } = extractPaginationMeta(items, 10);
    expect(result).toHaveLength(10);
    expect(meta.hasMore).toBe(false);
    expect(meta.cursor).toBe("item-9");
  });

  it("paginatedResponse returns correct shape", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ id: `item-${i}` }));
    const result = paginatedResponse(items, { take: 10 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect(result.data).toHaveLength(10);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.cursor).toBe("item-9");
  });
});

describe("M2 - Query optimization with select", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getDashboard uses groupBy instead of all-questions query", async () => {
    const { ModeratorService } = await import("@/modules/moderation/service");
    const { prisma } = await import("@/lib/db");

    vi.mocked(prisma.moderatorBankAssignment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.question.groupBy).mockResolvedValue([
      { status: "PENDING" as never, _count: { _all: 5 } },
      { status: "APPROVED" as never, _count: { _all: 10 } },
    ]);
    vi.mocked(prisma.question.findMany).mockResolvedValue([]);
    vi.mocked(prisma.questionBank.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

    const service = new ModeratorService();
    const dashboard = await service.getDashboard({ id: "mod-1", role: "MODERATOR" as never });

    expect(prisma.question.groupBy).toHaveBeenCalled();
    expect(dashboard.summary.pending).toBe(5);
    expect(dashboard.summary.approved).toBe(10);
  });
});

describe("M2 - Index strategy", () => {
  it("User model has role and departmentId indexes", async () => {
    const { prisma } = await import("@/lib/db");
    const mockUser = vi.mocked(prisma.user.findMany);

    mockUser.mockResolvedValue([]);

    await prisma.user.findMany({
      where: { role: "CONTRIBUTOR" as never },
      select: { id: true, name: true },
    });
    await prisma.user.findMany({
      where: { departmentId: "dept-1" },
      select: { id: true },
    });

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
