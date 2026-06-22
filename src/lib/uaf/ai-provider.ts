export interface AiOptions {
  model?: string;
  context?: number;
  temperature?: number;
  format?: "json";
  signal?: AbortSignal;
}

export interface AiResult {
  text: string;
  model: string;
  durationMs: number;
  tokensUsed?: number;
}

export interface AiProvider {
  analyze(prompt: string, options?: AiOptions): Promise<AiResult>;
}
