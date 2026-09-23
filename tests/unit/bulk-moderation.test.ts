import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: { questionBank: { findUnique: vi.fn() }, questionLibraryItem: { findMany: vi.fn() } } }));
vi.mock("@/modules/moderation/service", () => ({ ModeratorService: vi.fn() }));
import { prisma } from "@/lib/db";
import { BulkModerationService, bulkModerationSchema } from "@/modules/moderation/bulk-service";
import type { ModeratorService } from "@/modules/moderation/service";

const approve = vi.fn(), reject = vi.fn(), revise = vi.fn();
const service = new BulkModerationService({ approveQuestion: approve, rejectQuestion: reject, requestRevision: revise } as unknown as ModeratorService);
const ctx = { userId: "moderator", bankId: "bank" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.questionBank.findUnique).mockResolvedValue({ phase: "MODERATION", recordStatus: "ACTIVE" } as never);
  vi.mocked(prisma.questionLibraryItem.findMany).mockResolvedValue([{ id: "q1" }, { id: "q2" }] as never);
});
describe("bulk moderation", () => {
  it("requires a reason and limits unique selections", () => {
    expect(bulkModerationSchema.safeParse({ questionIds: ["q1"], action: "reject" }).success).toBe(false);
    expect(bulkModerationSchema.safeParse({ questionIds: ["q1", "q1"], action: "approve" }).success).toBe(false);
    expect(bulkModerationSchema.safeParse({ questionIds: [], action: "approve" }).success).toBe(false);
  });
  it("rejects out-of-bank selections before any mutation", async () => {
    vi.mocked(prisma.questionLibraryItem.findMany).mockResolvedValue([{ id: "q1" }] as never);
    await expect(service.run(ctx, { questionIds: ["q1", "q2"], action: "approve" })).rejects.toThrow("active moderation bank");
    expect(approve).not.toHaveBeenCalled();
  });
  it.each(["LOCKED", "ARCHIVED"])("rejects %s banks", async recordStatus => {
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue({ phase: "MODERATION", recordStatus } as never);
    await expect(service.run(ctx, { questionIds: ["q1", "q2"], action: "approve" })).rejects.toThrow("active bank");
    expect(approve).not.toHaveBeenCalled();
  });
  it("keeps failures visible and reports successful items", async () => {
    approve.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Question changed"));
    const result = await service.run(ctx, { questionIds: ["q1", "q2"], action: "approve" });
    expect(result.succeeded).toBe(1);
    expect(result.results[1]).toEqual({ questionId: "q2", success: false, error: "Question changed" });
  });
  it("sends revision instructions through the existing moderation workflow", async () => {
    await service.run(ctx, { questionIds: ["q1", "q2"], action: "request-revision", reason: "Correct units" });
    expect(revise).toHaveBeenCalledWith(ctx, "q1", "Correct units");
    expect(revise).toHaveBeenCalledWith(ctx, "q2", "Correct units");
  });
});
