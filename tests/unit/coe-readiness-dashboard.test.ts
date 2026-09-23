import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { CoeDashboardService } from "@/modules/coe/dashboard.service";
const { assess } = vi.hoisted(() => ({ assess: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { questionBank: { findMany: vi.fn() } } }));
vi.mock("@/modules/readiness/engine", () => ({ ReadinessEngine: class { isReady = assess; } }));

describe("COE readiness overview", () => {
  beforeEach(() => vi.clearAllMocks());
  it("assesses each next phase and distinguishes engine blockers from locks", async () => {
    vi.mocked(prisma.questionBank.findMany).mockResolvedValue([
      { id: "draft", phase: "DRAFTING", recordStatus: "ACTIVE" },
      { id: "revisions", phase: "MODERATION", recordStatus: "ACTIVE" },
      { id: "locked", phase: "MODERATION", recordStatus: "LOCKED" },
    ] as never);
    assess.mockImplementation(async (id: string, targetPhase: string) => ({ ready: id !== "revisions", targetPhase, issues: id === "revisions" ? ["Unresolved revisions"] : [], warnings: ["Coverage warning"] }));
    const rows = await new CoeDashboardService().getReadinessDashboard();
    expect(rows.map((row) => row.ready)).toEqual([true, false, false]);
    expect(rows[2].issues).toEqual(["Bank is locked."]);
    expect(rows[0].warnings).toEqual(["Coverage warning"]);
    expect(assess).toHaveBeenCalledWith("draft", "MODERATION");
    expect(assess).toHaveBeenCalledWith("revisions", "APPROVAL");
    expect(prisma.questionBank.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { phase: { in: ["DRAFTING", "MODERATION"] } } }));
  });
  it("returns an honest empty state without synthetic banks", async () => {
    vi.mocked(prisma.questionBank.findMany).mockResolvedValue([]);
    expect(await new CoeDashboardService().getReadinessDashboard()).toEqual([]);
    expect(assess).not.toHaveBeenCalled();
  });
});
