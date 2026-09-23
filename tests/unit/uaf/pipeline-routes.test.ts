import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { UAF_ANALYSIS_FILTER, EVALUATION_ANALYSIS_FILTER } from "@/lib/uaf/pipeline";

const db = vi.hoisted(() => ({
  questionBank: { findUnique: vi.fn() },
  questionBankAnalysis: { findFirst: vi.fn(), findMany: vi.fn() },
  analysisVersion: { findFirst: vi.fn(), findMany: vi.fn() },
  analysisSnapshot: { findFirst: vi.fn() },
  paperAnalysis: { findFirst: vi.fn(), findMany: vi.fn() },
  uAFMetric: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/api-handler", () => ({ withApiHandler: (handler: (request: NextRequest, context: unknown) => unknown) => (request: NextRequest) => handler(request, { auth: { user: { id: "dean" } } }) }));
vi.mock("@/modules/coordinator/department-utils", () => ({ DepartmentAccessUtils: class { async assertDepartmentAccess() {} } }));
import { GET as versions } from "../../../app/api/question-banks/[id]/analysis/versions/route";
import { GET as detail } from "../../../app/api/question-banks/[id]/analysis/versions/[vid]/route";
import { GET as compare } from "../../../app/api/question-banks/[id]/analysis/compare/route";
import { GET as papers } from "../../../app/api/question-banks/[id]/analysis/papers/route";
import { GET as paperDetail } from "../../../app/api/question-banks/[id]/analysis/papers/[paperId]/route";
import { GET as evaluationCompare } from "../../../app/api/question-banks/[id]/evaluation/compare/route";
import { GET as evaluationDetail } from "../../../app/api/question-banks/[id]/evaluation/versions/[vid]/route";
import { EvaluationOrchestrator } from "@/lib/evaluation/evaluation-orchestrator";

// Small in-memory predicate adapter lets mixed-origin fixtures exercise real routes
// and access checks, rather than returning successful data regardless of scope.
function matches(row: Record<string, any>, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((part: Record<string, any>) => matches(row, part));
    if (value && typeof value === "object") return row[key] != null && matches(row[key], value);
    return row[key] === value;
  });
}
const uaf = { id: "uaf-run", questionBankId: "bank", evaluationEngineVersion: "1.1.0", analysisSchemaVersion: "1.1.0", status: "COMPLETE" };
const evaluation = { ...uaf, id: "eval-run", ...EVALUATION_ANALYSIS_FILTER };
const unknown = { ...uaf, id: "unknown-run", evaluationEngineVersion: "other" };
const oldUaf = { ...uaf, id: "old-uaf-run", evaluationEngineVersion: "1.0.0", analysisSchemaVersion: "1.0.0" };
const versionRows = [unknown, evaluation, uaf, oldUaf].map((parent) => ({
  id: parent.id + "-v", evaluationEngineVersion: parent.evaluationEngineVersion,
  analysisSchemaVersion: parent.analysisSchemaVersion, questionBankAnalysis: parent,
}));
// Deliberately corrupted parent/version pair and a version from a different bank.
versionRows.push({ ...versionRows[2], id: "mismatched", questionBankAnalysis: evaluation });
versionRows.push({ ...versionRows[2], id: "foreign", questionBankAnalysis: { ...uaf, questionBankId: "other-bank" } });
const request = (path: string) => new NextRequest(`http://localhost/api/question-banks/bank/${path}`);

beforeEach(() => {
  vi.resetAllMocks();
  db.questionBank.findUnique.mockResolvedValue({ subject: { departmentId: "dept" } });
  db.analysisVersion.findFirst.mockImplementation(async ({ where }) => versionRows.find((r) => matches(r, where)) ?? null);
  db.analysisVersion.findMany.mockImplementation(async ({ where }) => versionRows.filter((r) => matches(r, where)));
  db.questionBankAnalysis.findFirst.mockImplementation(async ({ where }) => [unknown, evaluation, uaf, oldUaf].find((r) => matches(r, where)) ?? null);
  db.questionBankAnalysis.findMany.mockImplementation(async ({ where }) => [unknown, evaluation, uaf, oldUaf].filter((r) => matches(r, where)));
  const paperRows = [unknown, evaluation, uaf].map((parent) => ({ id: parent.id + "-paper", questionBankAnalysisId: parent.id, questionBankAnalysis: parent }));
  db.paperAnalysis.findFirst.mockImplementation(async ({ where }) => paperRows.find((r) => matches(r, where)) ?? null);
  db.paperAnalysis.findMany.mockImplementation(async ({ where }) => paperRows.filter((r) => matches(r, where)));
  db.uAFMetric.findMany.mockResolvedValue([]);
  db.analysisSnapshot.findFirst.mockResolvedValue({ fullReport: {} });
});

describe("pipeline-separated analysis routes", () => {
  it("lists only supported UAF versions from UAF parents", async () => {
    const result = (await versions(request("analysis/versions"))) as unknown as Array<{ id: string }>;
    expect(result.map((v) => v.id)).toEqual(["uaf-run-v", "old-uaf-run-v"]);
  });
  it.each(["eval-run-v", "unknown-run-v", "mismatched", "foreign"])("rejects non-UAF or foreign detail %s before loading the report", async (id) => {
    await expect(detail(request(`analysis/versions/${id}`))).rejects.toThrow("Analysis version not found");
    expect(db.analysisVersion.findFirst).toHaveBeenCalledTimes(1);
  });
  it("loads authorized UAF detail with origin scope on the final read", async () => {
    expect(((await detail(request("analysis/versions/uaf-run-v"))) as unknown as { id: string }).id).toBe("uaf-run-v");
    expect(db.analysisVersion.findFirst.mock.calls[1][0].where).toMatchObject({ ...UAF_ANALYSIS_FILTER, questionBankAnalysis: { questionBankId: "bank", ...UAF_ANALYSIS_FILTER } });
  });
  it("rejects mixed-pipeline UAF comparisons before querying metrics", async () => {
    await expect(compare(request("analysis/compare?v1=uaf-run-v&v2=eval-run-v"))).rejects.toThrow("Analysis version not found");
    expect(db.uAFMetric.findMany).not.toHaveBeenCalled();
  });
  it("scopes both metric queries in a valid UAF comparison", async () => {
    await compare(request("analysis/compare?v1=uaf-run-v&v2=old-uaf-run-v"));
    for (const [query] of db.uAFMetric.findMany.mock.calls) {
      expect(query.where.questionBankAnalysis).toMatchObject({ questionBankId: "bank", ...UAF_ANALYSIS_FILTER });
      expect(query.where.questionBankAnalysis.versions.some).toMatchObject(UAF_ANALYSIS_FILTER);
    }
  });
  it("lists papers from the latest UAF run even when newer other-pipeline runs exist", async () => {
    expect(((await papers(request("analysis/papers"))) as unknown as { papers: Array<{ id: string }> }).papers.map((p) => p.id)).toEqual(["uaf-run-paper"]);
  });
  it("does not expose other-pipeline paper IDs", async () => {
    expect(await paperDetail(request("analysis/papers/eval-run-paper"))).toBeNull();
    expect(((await paperDetail(request("analysis/papers/uaf-run-paper"))) as unknown as { id: string }).id).toBe("uaf-run-paper");
  });
});

describe("evaluation pipeline readers", () => {
  const orchestrator = new EvaluationOrchestrator();
  it("filters latest/list readers and their nested versions", async () => {
    expect((await orchestrator.getLatest("bank"))?.id).toBe("eval-run");
    expect((await orchestrator.listVersions("bank")).map((r) => r.id)).toEqual(["eval-run"]);
    for (const query of [db.questionBankAnalysis.findFirst.mock.calls[0][0], db.questionBankAnalysis.findMany.mock.calls[0][0]]) {
      expect(query.select.versions.where).toEqual(EVALUATION_ANALYSIS_FILTER);
    }
  });
  it("getVersion rejects UAF, unknown and mismatched versions", async () => {
    for (const id of ["uaf-run-v", "unknown-run-v", "mismatched", "foreign"]) expect(await orchestrator.getVersion(id, "bank")).toBeNull();
    expect((await orchestrator.getVersion("eval-run-v", "bank"))?.id).toBe("eval-run-v");
  });
  it("evaluation detail rejects a UAF ID and permits an evaluation ID", async () => {
    await expect(evaluationDetail(request("evaluation/versions/uaf-run-v"))).rejects.toThrow("Analysis version not found");
    expect(((await evaluationDetail(request("evaluation/versions/eval-run-v"))) as unknown as { id: string }).id).toBe("eval-run-v");
  });
  it("rejects mixed evaluation comparisons before loading snapshots", async () => {
    await expect(evaluationCompare(request("evaluation/compare?v1=eval-run-v&v2=uaf-run-v"))).rejects.toThrow("Analysis version not found");
    expect(db.analysisSnapshot.findFirst).not.toHaveBeenCalled();
  });
  it("scopes evaluation comparison snapshot reads", async () => {
    await evaluationCompare(request("evaluation/compare?v1=eval-run-v&v2=eval-run-v"));
    for (const [query] of db.analysisSnapshot.findFirst.mock.calls) {
      expect(query.where.analysisVersion).toEqual({ ...EVALUATION_ANALYSIS_FILTER, questionBankAnalysis: { questionBankId: "bank", ...EVALUATION_ANALYSIS_FILTER } });
    }
  });
});
