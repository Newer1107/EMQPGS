import { env } from "@/lib/env";
import type { AiProvider, AiProviderResult } from "@/modules/ai/ai-provider";

const AI_TIMEOUT_MS = 30_000;

type OllamaGenerateResponse = {
  response?: string;
};

export class OllamaService implements AiProvider {
  async analyze(prompt: string): Promise<AiProviderResult<string>> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const response = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          prompt,
          stream: false,
          format: "json",
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        return { success: false, error: `Ollama returned status ${response.status}` };
      }

      const data = (await response.json()) as OllamaGenerateResponse;
      if (!data.response) {
        return { success: false, error: "Ollama returned empty response" };
      }

      return { success: true, data: data.response };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: message };
    }
  }
}
