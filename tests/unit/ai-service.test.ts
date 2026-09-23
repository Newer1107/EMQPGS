import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AiReportService } from "@/modules/reports/ai-report.service";
import { OllamaService } from "@/modules/ai/ollama-service";
import type { AiProviderResult } from "@/modules/ai/ai-provider";

vi.mock("@/lib/env", () => ({ env: {
  NODE_ENV: "test",
  AI_BASE_URL: "https://gateway.example.test/v1",
  AI_API_KEY: "test-gateway-key",
  AI_MODEL: "configured-model",
} }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

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
  it("uses fallback summary when AI returns null", () => {
    const result: AiProviderResult<string> = { success: false, error: "AI gateway offline" };
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
  const service = new AiReportService();
  return {
    parseAiOverlay: (result: AiProviderResult<string>) => service["parseAiOverlay"](result),
  };
}

describe("report AI gateway", () => {
  const mockFetch = vi.fn<typeof fetch>();
  const service = new OllamaService();
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("uses the configured OpenAI-compatible endpoint, model, and bearer authentication", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "analysis" } }] })));
    expect(await service.analyze("prompt")).toEqual({ success: true, data: "analysis" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://gateway.example.test/v1/chat/completions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer test-gateway-key" });
    expect(JSON.parse(init!.body as string)).toEqual({ model: "configured-model", messages: [{ role: "user", content: "prompt" }], stream: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([401, 429, 500])("returns fallback for HTTP %s without retries", async (status) => {
    mockFetch.mockResolvedValue(new Response("gateway failure", { status }));
    expect(await service.analyze("prompt")).toEqual({ success: false, error: `AI Gateway returned status ${status}` });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([{}, { choices: [] }, { choices: [{ message: { content: "" } }] }])("rejects missing or empty completion content: %j", async (body) => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify(body)));
    expect(await service.analyze("prompt")).toEqual({ success: false, error: "AI Gateway returned empty response" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns fallback and clears the timeout when fetch rejects", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));
    expect(await service.analyze("prompt")).toEqual({ success: false, error: "Network failure" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns fallback for malformed JSON", async () => {
    mockFetch.mockResolvedValue(new Response("not JSON"));
    expect(await service.analyze("prompt")).toMatchObject({ success: false, error: expect.any(String) });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts at the existing 120 second timeout without retries", async () => {
    mockFetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error("Timed out")), { once: true });
    }));
    const pending = service.analyze("prompt");
    await vi.advanceTimersByTimeAsync(119_999);
    expect(mockFetch.mock.calls[0][1]!.signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ success: false, error: "Timed out" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
