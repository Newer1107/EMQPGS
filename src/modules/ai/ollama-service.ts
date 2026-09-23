import { env } from "@/lib/env";
import type { AiProvider, AiProviderResult } from "@/modules/ai/ai-provider";
import { logger } from "@/lib/logger";

const AI_TIMEOUT_MS = 120_000;

const isDev = () => env.NODE_ENV === "development";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { total_tokens?: number };
};

export class OllamaService implements AiProvider {
  async analyze(prompt: string): Promise<AiProviderResult<string>> {
    const start = performance.now();
    if (isDev()) logger.info("AI Gateway request", { promptLength: prompt.length });

    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (isDev()) logger.warn("AI Gateway timeout", { timeoutMs: AI_TIMEOUT_MS });
      controller.abort();
    }, AI_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.AI_MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
        signal: controller.signal,
      });

      const duration = Math.round(performance.now() - start);

      if (!response.ok) {
        if (isDev()) logger.warn("AI Gateway non-ok response", { status: response.status, durationMs: duration });
        return { success: false, error: `AI Gateway returned status ${response.status}` };
      }

      const data = (await response.json()) as ChatCompletionResponse;
      const text = data.choices?.[0]?.message?.content || "";
      if (!text) {
        if (isDev()) logger.warn("AI Gateway empty response", { durationMs: duration });
        return { success: false, error: "AI Gateway returned empty response" };
      }

      if (isDev()) logger.info("AI Gateway success", { durationMs: duration, responseLength: text.length });
      return { success: true, data: text };
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const message = err instanceof Error ? err.message : "Unknown error";
      if (isDev()) logger.warn("AI Gateway error", { error: message, durationMs: duration });
      return { success: false, error: message };
    } finally {
      clearTimeout(timer);
    }
  }
}
