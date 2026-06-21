import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiReportService } from "@/modules/reports/ai-report.service";
import { AnalysisEngine } from "@/modules/reports/analysis-engine";
import { aiOverlaySchema } from "@/modules/ai/types";
import type { AiProviderResult } from "@/modules/ai/ai-provider";

vi.mock("@/lib/db", () => ({
  prisma: {
    questionBank: {
      findUnique: vi.fn().mockResolvedValue({
        id: "qb-1",
        subject: { subjectCode: "CS501", subjectName: "Algorithms", departmentId: "dept-1" },
        batchSemester: { academicYear: { code: "2026" }, semesterNumber: 5 },
        pattern: { totalModules: 6, marksPattern: [2, 5, 10], slotsPerModule: 7, totalSlots: 126 },
        slots: [],
      }),
    },
    aiReport: {
      create: vi.fn().mockResolvedValue({ id: "report-1", status: "COMPLETED" }),
    },
    responsibilityAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/modules/notifications/service", () => ({ NotificationService: vi.fn(() => ({ create: vi.fn() })) }));

describe("AiReportService parseAiOverlay", () => {
  const engine = new AnalysisEngine();

  it("uses fallback summary when AI returns null", () => {
    const result: AiProviderResult<string> = { success: false, error: "Ollama offline" };
    const { parseAiOverlay } = getPrivateMethod();
    const overlay = parseAiOverlay(result);
    expect(overlay).toBeNull();
  });

  it("uses fallback when AI returns invalid JSON", () => {
    const result: AiProviderResult<string> = { success: true, data: "not json" };
    const { parseAiOverlay } = getPrivateMethod();
    const overlay = parseAiOverlay(result);
    expect(overlay).toBeNull();
  });

  it("uses fallback when AI returns JSON with missing required fields", () => {
    const result: AiProviderResult<string> = { success: true, data: JSON.stringify({ executiveSummary: "Only this" }) };
    const { parseAiOverlay } = getPrivateMethod();
    const overlay = parseAiOverlay(result);
    expect(overlay).toBeNull();
  });

  it("rejects extra fields from AI response", () => {
    const result: AiProviderResult<string> = {
      success: true,
      data: JSON.stringify({
        executiveSummary: "Summary.",
        missingAreas: [],
        qualityFindings: [],
        bloomsBalance: "Balanced.",
        moduleCoverage: [{ label: "1", total: 21, approved: 10, missing: 11 }],
      }),
    };
    const { parseAiOverlay } = getPrivateMethod();
    const overlay = parseAiOverlay(result);
    expect(overlay).toBeNull();
  });

  it("accepts valid AI overlay with all four fields", () => {
    const result: AiProviderResult<string> = {
      success: true,
      data: JSON.stringify({
        executiveSummary: "Good coverage.",
        missingAreas: ["Module 3 gap"],
        qualityFindings: ["Easy/hard imbalance"],
        bloomsBalance: "Balanced.",
      }),
    };
    const { parseAiOverlay } = getPrivateMethod();
    const overlay = parseAiOverlay(result);
    expect(overlay).not.toBeNull();
    expect(overlay!.executiveSummary).toBe("Good coverage.");
    expect(overlay!.missingAreas).toEqual(["Module 3 gap"]);
  });
});

function getPrivateMethod() {
  const service = new (AiReportService as any)();
  return {
    parseAiOverlay: (result: AiProviderResult<string>) => service.parseAiOverlay(result),
  };
}
