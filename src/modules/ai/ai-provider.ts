export type AiProviderResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface AiProvider {
  analyze(prompt: string): Promise<AiProviderResult<string>>;
}
