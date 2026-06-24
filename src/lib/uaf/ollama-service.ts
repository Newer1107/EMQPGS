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

    const raw = (await response.json()) as {
      response?: string;
      thinking?: string;
      model?: string;
      eval_count?: number;
    };
    const durationMs = Date.now() - startTime;

    // ponytail: Qwen3 puts output in "thinking", not "response".
    // Fall back to thinking when response is empty.
    const text = raw.response || raw.thinking || "";

    return {
      text,
      model: data.model ?? model,
      durationMs,
      tokensUsed: data.eval_count,
    };
  }

  /**
   * Analyzes a single module with retry logic.
   * ponytail: maxRetries=1 — the caller (EvaluationOrchestrator) already handles
   * fallback (deterministic commentary).  Retrying a 500 from Ollama for 360s
   * just to fall back wastes time.  Fail fast, fall back fast.
   */
  async analyzeWithRetry(
    prompt: string,
    moduleId: string,
    options?: AiOptions,
  ): Promise<{ result: AiResult | null; retryCount: number }> {
    const maxRetries = 1;
    const promptChars = prompt.length;
    const estimatedTokens = Math.ceil(promptChars / 4);

    logger.info("Ollama call starting", {
      moduleId,
      promptChars,
      estimatedTokens,
      model: options?.model ?? this.defaultModel,
      context: options?.context ?? 8192,
    });

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

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
          tokensUsed: result.tokensUsed,
        });

        return { result, retryCount: attempt - 1 };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn("Ollama module attempt failed", {
          moduleId,
          attempt,
          error: lastError.message,
          promptChars,
          estimatedTokens,
        });
      }
    }

    logger.warn("Ollama call exhausted — returning null", {
      moduleId,
      error: lastError?.message,
      promptChars,
      estimatedTokens,
    });

    return { result: null, retryCount: maxRetries };
  }
}
