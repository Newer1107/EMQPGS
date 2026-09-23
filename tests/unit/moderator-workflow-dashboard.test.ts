import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { ModeratorDashboardService } from "@/modules/moderation/dashboard.service";

vi.mock("@/lib/db", () => ({ prisma: {
  questionLibraryItem: { groupBy: vi.fn(), findMany: vi.fn() },
  questionSlot: { findMany: vi.fn() }, moderationEvent: { findMany: vi.fn() },
} }));
vi.mock("@/modules/notifications/service", () => ({ NotificationService: class { listForUser = vi.fn().mockResolvedValue([]); } }));

describe("moderator resubmission queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.questionLibraryItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.moderationEvent.findMany).mockResolvedValue([]);
  });
  it("counts resubmissions, queries both actionable statuses and retains actual subject context", async () => {
    vi.mocked(prisma.questionLibraryItem.groupBy).mockResolvedValue([
      { status: "PENDING", _count: { _all: 2 } }, { status: "REVISION_SUBMITTED", _count: { _all: 3 } },
    ] as never);
    vi.mocked(prisma.questionSlot.findMany).mockResolvedValue([{
      moduleNumber: 1, marks: 5, questionBank: { subject: { subjectName: "Math", subjectCode: "M1" } },
      assignedQuestion: { id: "q", status: "REVISION_SUBMITTED", submittedAt: new Date(), createdAt: new Date(), creator: { name: "Author" } },
    }] as never);
    const result = await new ModeratorDashboardService().getDashboard({ userId: "moderator", bankId: "bank" });
    expect(result.summary.pending).toBe(5);
    expect(result.pendingQueue[0]).toMatchObject({ status: "REVISION_SUBMITTED", subjectName: "Math", subjectCode: "M1" });
    expect(prisma.questionSlot.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { questionBankId: "bank", assignedQuestion: { status: { in: ["PENDING", "REVISION_SUBMITTED"] } } } }));
    expect(prisma.moderationEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { moderatorId: "moderator", question: { slotAssignments: { some: { questionBankId: "bank" } } } } }));
  });
});
