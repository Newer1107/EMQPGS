import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { EVALUATION_ANALYSIS_FILTER } from "@/lib/uaf/pipeline";

const mocks = vi.hoisted(() => ({ bank: vi.fn(), version: vi.fn(), access: vi.fn(), pdf: vi.fn(), auth: { userId: "coordinator" } }));
vi.mock("@/lib/api-handler", () => ({ withApiHandler: (handler: (request: NextRequest, context: unknown) => unknown) => (request: NextRequest) => handler(request, { auth: mocks.auth }) }));
vi.mock("@/lib/db", () => ({ prisma: { questionBank: { findUnique: mocks.bank }, analysisVersion: { findFirst: mocks.version } } }));
vi.mock("@/modules/coordinator/department-utils", () => ({ DepartmentAccessUtils: class { assertDepartmentAccess = mocks.access; } }));
vi.mock("@/modules/evaluation-export/pdf", () => ({ exportEvaluationPdf: mocks.pdf }));
import { GET } from "../app/api/question-banks/[id]/evaluation/export/route";

describe("evaluation export bank/version scope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.bank.mockResolvedValue({ subject: { departmentId: "dept-a" } });
    mocks.access.mockResolvedValue(undefined);
    mocks.version.mockResolvedValue({ id: "version-a", versionNumber: 2, analysisSnapshot: { fullReport: { engineVersion: "eval-1.0.0" } } });
    mocks.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  });
  it("authorizes the bank department and constrains the version to the evaluation pipeline", async () => {
    const response = await GET(new NextRequest("http://localhost/api/question-banks/bank-a/evaluation/export?versionId=version-a"));
    expect(mocks.access).toHaveBeenCalledWith(mocks.auth, "dept-a");
    expect(mocks.version.mock.calls[0][0].where).toEqual({ id: "version-a", ...EVALUATION_ANALYSIS_FILTER, questionBankAnalysis: { questionBankId: "bank-a", ...EVALUATION_ANALYSIS_FILTER } });
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("evaluation-report-v2.pdf");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("%PDF");
  });
  it("does not read or export a version when department access is denied", async () => {
    mocks.access.mockRejectedValue(new Error("Forbidden"));
    await expect(GET(new NextRequest("http://localhost/api/question-banks/bank-a/evaluation/export"))).rejects.toThrow("Forbidden");
    expect(mocks.version).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
  it("rejects a missing or cross-pipeline version without exporting", async () => {
    mocks.version.mockResolvedValue(null);
    await expect(GET(new NextRequest("http://localhost/api/question-banks/bank-a/evaluation/export?versionId=foreign"))).rejects.toThrow("Analysis version not found in this bank");
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
  it("rejects a version without a stored evaluation report", async () => {
    mocks.version.mockResolvedValue({ id: "version-a", versionNumber: 2, analysisSnapshot: null });
    await expect(GET(new NextRequest("http://localhost/api/question-banks/bank-a/evaluation/export?versionId=version-a"))).rejects.toThrow("Evaluation report not available for this version");
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});
