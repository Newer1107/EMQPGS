import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OllamaService } from "@/lib/uaf/ollama-service";

vi.mock("@/lib/env", () => ({ env: {
  AI_BASE_URL: "https://gateway.example.test/v1",
  AI_API_KEY: "test-gateway-key",
  AI_MODEL: "configured-model",
} }));

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
        choices: [{ message: { role: "assistant", content: "test response" } }],
        model: "served-model",
        usage: { total_tokens: 123 },
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
    vi.useFakeTimers();
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
        model: "served-model",
        tokensUsed: 123,
      });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(callArgs[0]).toBe("https://gateway.example.test/v1/chat/completions");
      expect(callArgs[1].method).toBe("POST");
      expect(callArgs[1].headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer test-gateway-key" });
      const body = JSON.parse(callArgs[1].body as string);
      expect(body).toEqual({ model: "configured-model", messages: [{ role: "user", content: prompt }], stream: false, temperature: 0.7 });
    });

    it("throws on non-200 response", async () => {
      mockFetch.mockResolvedValue(
        mockResponse({ ok: false, status: 500, statusText: "Internal Server Error" }),
      );

      await expect(service.analyze(prompt)).rejects.toThrow("AI Gateway error: 500");
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

    it("honors model and temperature overrides and tolerates missing usage metadata", async () => {
      mockFetch.mockResolvedValue(mockResponse({ json: async () => ({ choices: [{ message: { content: "answer" } }] }) }));
      const result = await service.analyze(prompt, { model: "custom-model", temperature: 0 });
      expect(result).toMatchObject({ text: "answer", model: "custom-model" });
      expect(result.tokensUsed).toBeUndefined();
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ model: "custom-model", temperature: 0 });
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
      expect(vi.getTimerCount()).toBe(0);
    });

    it("fails fast after one attempt even when a subsequent request would succeed", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(mockResponse());

      const result = await service.analyzeWithRetry(prompt, moduleId);
      expect(result).toEqual({ result: null, retryCount: 1 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("returns deterministic fallback on an HTTP failure without retrying", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: false, status: 503 }));
      expect(await service.analyzeWithRetry(prompt, moduleId)).toEqual({ result: null, retryCount: 1 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("aborts at the existing 120 second timeout and returns fallback", async () => {
      mockFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(new Error("Timed out")), { once: true });
      }));
      const pending = service.analyzeWithRetry(prompt, moduleId);
      await vi.advanceTimersByTimeAsync(119_999);
      expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual({ result: null, retryCount: 1 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
