import { env } from "@/lib/env";
import type { AiQuestionBankReport } from "@/modules/ai/types";

type OllamaResponse = {
  response?: string;
};

export class OllamaService {
  async analyzeQuestionBank(prompt: string): Promise<Partial<AiQuestionBankReport> | null> {
    try {
      const response = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          prompt,
          stream: false,
          format: "json",
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OllamaResponse;
      if (!data.response) return null;
      return JSON.parse(data.response) as Partial<AiQuestionBankReport>;
    } catch {
      return null;
    }
  }
}
