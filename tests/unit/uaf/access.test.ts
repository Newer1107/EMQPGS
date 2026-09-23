import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: { questionBank: { findUnique: vi.fn() }, analysisVersion: { findFirst: vi.fn() } } }));
const assertDepartmentAccess = vi.hoisted(() => vi.fn());
vi.mock("@/modules/coordinator/department-utils", () => ({ DepartmentAccessUtils: class { assertDepartmentAccess = assertDepartmentAccess; } }));
import { prisma } from "@/lib/db";
import { requireAnalysisAccess } from "@/lib/uaf/access";
const auth = { user: { id: "u", name: "Auditor", email: "a@example.test" }, responsibilities: [] };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(prisma.questionBank.findUnique).mockResolvedValue({ subject: { departmentId: "dept" } } as never); });
describe("analysis resource authorization", () => {
  it("requires the bank department before loading versions", async () => {
    assertDepartmentAccess.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(requireAnalysisAccess(auth, "bank", ["v"])).rejects.toThrow("Forbidden");
    expect(prisma.analysisVersion.findFirst).not.toHaveBeenCalled();
  });
  it("rejects versions from another bank", async () => {
    vi.mocked(prisma.analysisVersion.findFirst).mockResolvedValue(null);
    await expect(requireAnalysisAccess(auth, "bank", ["other"])).rejects.toThrow("not found in this bank");
    expect(prisma.analysisVersion.findFirst).toHaveBeenCalledWith({ where: { id: "other", questionBankAnalysis: { questionBankId: "bank" } }, select: { id: true } });
  });
  it("permits authorized comparisons within a bank", async () => {
    vi.mocked(prisma.analysisVersion.findFirst).mockResolvedValue({ id: "v" } as never);
    await requireAnalysisAccess(auth, "bank", ["v", "v"]);
    expect(assertDepartmentAccess).toHaveBeenCalledWith(auth, "dept");
    expect(prisma.analysisVersion.findFirst).toHaveBeenCalledTimes(1);
  });
});
