import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OllamaService } from "@/lib/uaf/ollama-service";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function mockResponse(overrides: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: () =>
      Promise.resolve({
        response: "test response",
        model: "llama3.1",
        eval_count: 123,
      }),
    ...overrides,
  } as Response;
}

const prompt = "Analyze this question bank";
const moduleId = "EXECUTIVE_SUMMARY";

describe("OllamaService", () => {
  let service: OllamaService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    service = new OllamaService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("analyze", () => {
    it("returns AiResult with correct shape on success", async () => {
      mockFetch.mockResolvedValue(mockResponse());

      const result = await service.analyze(prompt);

      expect(result).toMatchObject({
        text: "test response",
        model: "llama3.1",
        tokensUsed: 123,
      });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(callArgs[0]).toContain("/api/generate");
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.model).toBe("llama3.1");
      expect(body.prompt).toBe(prompt);
    });

    it("throws on non-200 response", async () => {
      mockFetch.mockResolvedValue(
        mockResponse({ ok: false, status: 500, statusText: "Internal Server Error" }),
      );

      await expect(service.analyze(prompt)).rejects.toThrow("Ollama API error: 500");
    });

    it("throws on timeout (AbortSignal)", async () => {
      const controller = new AbortController();
      controller.abort();

      // Simulate fetch rejecting when signal is already aborted
      mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal?.aborted) {
          throw new Error("The operation was aborted");
        }
        return mockResponse();
      });

      await expect(
        service.analyze(prompt, { signal: controller.signal }),
      ).rejects.toThrow("The operation was aborted");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("analyzeWithRetry", () => {
    it("succeeds on first attempt", async () => {
      mockFetch.mockResolvedValue(mockResponse());

      const result = await service.analyzeWithRetry(prompt, moduleId);

      expect(result.result).not.toBeNull();
      expect(result.result!.text).toBe("test response");
      expect(result.retryCount).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and succeeds on retry", async () => {
      vi.useFakeTimers();

      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(mockResponse());

      const promise = service.analyzeWithRetry(prompt, moduleId);

      // Advance past retry delays: 1000ms + 2000ms
      await vi.advanceTimersByTimeAsync(3000);

      const result = await promise;

      expect(result.result).not.toBeNull();
      expect(result.result!.text).toBe("test response");
      expect(result.retryCount).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("returns null after exhausting all retries", async () => {
      vi.useFakeTimers();

      mockFetch.mockRejectedValue(new Error("Network error"));

      const promise = service.analyzeWithRetry(prompt, moduleId);

      // Advance past retry delays: 1000ms + 2000ms
      await vi.advanceTimersByTimeAsync(3000);

      const result = await promise;

      expect(result.result).toBeNull();
      expect(result.retryCount).toBe(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
