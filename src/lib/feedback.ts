import { toast } from "sonner";
import { NotificationService } from "@/modules/notifications/service";
import { prisma } from "@/lib/db";
import { NotificationType } from "@prisma/client";
import { logger } from "@/lib/logger";

const notificationService = new NotificationService();

export interface FeedbackSuccessInput {
  /** The toast title. */
  title: string;
  /** Optional supporting text shown below the title. */
  description?: string;
  /** If provided, appended to the description as a navigation suggestion. */
  nextHref?: string;
  /** Label for the next-href link (default: "View"). */
  nextLabel?: string;
}

/**
 * Centralised user-facing feedback — toast messages and, where needed,
 * persisted Notification records.
 *
 * Every method fires a sonner toast. `actionRequired` additionally creates
 * in-app Notification rows for every user matching the target role.
 *
 * @example
 * ```ts
 * feedback.success({ title: "Saved", description: "Your changes are live." })
 * feedback.error("Something went wrong", err)
 * await feedback.actionRequired("Dean review pending", "DEAN", bankId)
 * ```
 */
export const feedback = {
  /**
   * Display a success toast.
   *
   * When `nextHref` is provided the description is appended with a
   * "→ {nextLabel} ({nextHref})" hint so the user knows where to go next.
   */
  success(input: FeedbackSuccessInput): void {
    const { title, description, nextHref, nextLabel = "View" } = input ?? {};
    if (!title) return;

    const parts: string[] = [];
    if (description) parts.push(description);
    if (nextHref) parts.push(`→ ${nextLabel}: ${nextHref}`);

    toast.success(title, parts.length > 0 ? { description: parts.join("\n") } : undefined);
  },

  /**
   * Display an error toast.
   *
   * If `error` is an `Error` instance (or any object with a `.message`
   * property) that message is appended to the displayed text.
   */
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

  /**
   * Display a warning toast with an optional supporting description.
   */
  warning(message: string, description?: string): void {
    if (!message) return;
    toast.warning(message, description ? { description } : undefined);
  },

  /**
   * Display an info toast with an optional supporting description.
   */
  info(message: string, description?: string): void {
    if (!message) return;
    toast.info(message, description ? { description } : undefined);
  },

  /**
   * Show a warning toast **and** create in-app Notification records for
   * every active user whose role matches `assigneeRole`.
   *
   * Notifications are created with type `ACTION_REQUIRED` so the inbox UI
   * can visually distinguish them from generic alerts.
   *
   * Failures to persist notifications are logged but never propagated —
   * the toast has already been shown to the user.
   */
  async actionRequired(message: string, assigneeRole: string, entityId: string): Promise<void> {
    if (!message || !assigneeRole) return;

    // Show the toast immediately regardless of DB outcome
    toast.warning(message, { description: `Action needed (${entityId})` });

    try {
      const users = await prisma.user.findMany({
        where: { role: assigneeRole as any, status: "ACTIVE" },
        select: { id: true },
      });

      if (users.length === 0) {
        logger.warn("feedback.actionRequired: no active users found for role", {
          assigneeRole,
          entityId,
        });
        return;
      }

      await Promise.all(
        users.map((user) =>
          notificationService.create(
            user.id,
            message,
            `Action required for entity: ${entityId}`,
            undefined,
            NotificationType.ACTION_REQUIRED,
          ),
        ),
      );
    } catch (err) {
      logger.error("feedback.actionRequired: failed to create notifications", {
        assigneeRole,
        entityId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};
