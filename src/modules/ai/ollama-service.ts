import { env } from "@/lib/env";
import type { AiProvider, AiProviderResult } from "@/modules/ai/ai-provider";
import { logger } from "@/lib/logger";

const AI_TIMEOUT_MS = 120_000;
const AI_CONTEXT_WINDOW = 8192;

const isDev = () => env.NODE_ENV === "development";

type OllamaGenerateResponse = {
  response?: string;
  thinking?: string;
};

export class OllamaService implements AiProvider {
  async analyze(prompt: string): Promise<AiProviderResult<string>> {
    const start = performance.now();
    if (isDev()) logger.info("Ollama request", { promptLength: prompt.length });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        if (isDev()) logger.warn("Ollama timeout", { timeoutMs: AI_TIMEOUT_MS });
        controller.abort();
      }, AI_TIMEOUT_MS);

      const response = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          prompt,
          stream: false,
          format: "json",
          options: { num_ctx: AI_CONTEXT_WINDOW },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const duration = Math.round(performance.now() - start);

      if (!response.ok) {
        if (isDev()) logger.warn("Ollama non-ok response", { status: response.status, durationMs: duration });
        return { success: false, error: `Ollama returned status ${response.status}` };
      }

      const data = (await response.json()) as OllamaGenerateResponse;
      // ponytail: Qwen3 puts output in "thinking", not "response".
      const text = data.response || data.thinking || "";
      if (!text) {
        if (isDev()) logger.warn("Ollama empty response", { durationMs: duration });
        return { success: false, error: "Ollama returned empty response" };
      }

      if (isDev()) logger.info("Ollama success", { durationMs: duration, responseLength: text.length });
      return { success: true, data: text };
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const message = err instanceof Error ? err.message : "Unknown error";
      if (isDev()) logger.warn("Ollama error", { error: message, durationMs: duration });
      return { success: false, error: message };
    }
  }
}
