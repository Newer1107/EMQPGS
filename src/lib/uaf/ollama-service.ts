import { AiProvider, AiOptions, AiResult } from "./ai-provider";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export class OllamaService implements AiProvider {
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.baseUrl = env.OLLAMA_BASE_URL;
    this.defaultModel = env.OLLAMA_MODEL;
  }

  async analyze(prompt: string, options?: AiOptions): Promise<AiResult> {
    const model = options?.model ?? this.defaultModel;
    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: options?.format ?? "json",
        options: {
          num_ctx: options?.context ?? 8192,
          temperature: options?.temperature ?? 0.7,
        },
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      response?: string;
      model?: string;
      eval_count?: number;
    };
    const durationMs = Date.now() - startTime;

    return {
      text: data.response ?? "",
      model: data.model ?? model,
      durationMs,
      tokensUsed: data.eval_count,
    };
  }

  /**
   * Analyzes a single module with retry logic.
   * Retry policy: attempt 1 (timeout/error) → attempt 2 (same) → attempt 3 (same) → fallback
   */
  async analyzeWithRetry(
    prompt: string,
    moduleId: string,
    options?: AiOptions,
  ): Promise<{ result: AiResult | null; retryCount: number }> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

        const result = await this.analyze(prompt, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        logger.info("Ollama module complete", {
          moduleId,
          attempt,
          model: result.model,
          durationMs: result.durationMs,
        });

        return { result, retryCount: attempt - 1 };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn("Ollama module attempt failed", {
          moduleId,
          attempt,
          error: lastError.message,
        });

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }

    logger.error("Ollama module exhausted retries", {
      moduleId,
      error: lastError?.message,
    });

    return { result: null, retryCount: maxRetries };
  }
}
