import { AiProvider, AiOptions, AiResult } from "./ai-provider";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  usage?: { total_tokens?: number };
};

export class OllamaService implements AiProvider {
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.baseUrl = env.AI_BASE_URL;
    this.apiKey = env.AI_API_KEY;
    this.defaultModel = env.AI_MODEL;
  }

  async analyze(prompt: string, options?: AiOptions): Promise<AiResult> {
    const model = options?.model ?? this.defaultModel;
    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        temperature: options?.temperature ?? 0.7,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status} ${response.statusText}`);
    }

    const raw = (await response.json()) as ChatCompletionResponse;
    const durationMs = Date.now() - startTime;

    const text = raw.choices?.[0]?.message?.content || "";

    return {
      text,
      model: raw.model ?? model,
      durationMs,
      tokensUsed: raw.usage?.total_tokens,
    };
  }

  /**
   * Analyzes a single module with retry logic.
   * ponytail: maxRetries=1 — the caller (EvaluationOrchestrator) already handles
   * fallback (deterministic commentary).  Retrying a 500 from the AI gateway for 360s
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

    logger.info("AI Gateway call starting", {
      moduleId,
      promptChars,
      estimatedTokens,
      model: options?.model ?? this.defaultModel,
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

        logger.info("AI Gateway module complete", {
          moduleId,
          attempt,
          model: result.model,
          durationMs: result.durationMs,
          tokensUsed: result.tokensUsed,
        });

        return { result, retryCount: attempt - 1 };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn("AI Gateway module attempt failed", {
          moduleId,
          attempt,
          error: lastError.message,
          promptChars,
          estimatedTokens,
        });
      }
    }

    logger.warn("AI Gateway call exhausted — returning null", {
      moduleId,
      error: lastError?.message,
      promptChars,
      estimatedTokens,
    });

    return { result: null, retryCount: maxRetries };
  }
}
