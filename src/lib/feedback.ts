import { toast } from "sonner";

export interface FeedbackSuccessInput {
  title: string;
  description?: string;
  nextHref?: string;
  nextLabel?: string;
}

export const feedback = {
  success(input: FeedbackSuccessInput): void {
    const { title, description, nextHref, nextLabel = "View" } = input ?? {};
    if (!title) return;

    const parts: string[] = [];
    if (description) parts.push(description);
    if (nextHref) parts.push(`\u2192 ${nextLabel}: ${nextHref}`);

    toast.success(title, parts.length > 0 ? { description: parts.join("\n") } : undefined);
  },

  error(message: string, error?: Error | unknown): void {
    if (!message) return;

    const safeMessage =
      error instanceof Error
        ? `${message}: ${error.message}`
        : error && typeof error === "object" && "message" in (error as Record<string, unknown>)
          ? `${message}: ${String((error as Record<string, unknown>).message)}`
          : error !== undefined
            ? `${message}: ${String(error)}`
            : message;

    toast.error(safeMessage);
  },

  warning(message: string, description?: string): void {
    if (!message) return;
    toast.warning(message, description ? { description } : undefined);
  },

  info(message: string, description?: string): void {
    if (!message) return;
    toast.info(message, description ? { description } : undefined);
  },
};
