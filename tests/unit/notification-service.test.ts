import { NotificationType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationService } from "@/modules/notifications/service";
import { EmailService } from "@/modules/notifications/email-service";

const mockCreateNotification = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      create: (...args: unknown[]) => mockCreateNotification(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const defaultRecipient = { id: "user-1", email: "user@example.com", name: "Test User" };

describe("NotificationService.createAndEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNotification.mockResolvedValue({ id: "notif-1" });
  });

  it("creates notification and sends email when email succeeds", async () => {
    const mockEmailService = {
      sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
    };
    const service = new NotificationService(mockEmailService as unknown as EmailService);

    await service.createAndEmail(
      defaultRecipient,
      "Test title",
      "Test message",
      "/test-url",
      NotificationType.INFO,
    );

    expect(mockCreateNotification).toHaveBeenCalledWith({
      data: {
        recipientId: "user-1",
        title: "Test title",
        message: "Test message",
        actionUrl: "/test-url",
        type: NotificationType.INFO,
      },
    });
    expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith(
      "user@example.com",
      "Test title",
      "Test User, Test message",
    );
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it("creates notification and does not throw when email sending fails", async () => {
    const mockEmailService = {
      sendNotificationEmail: vi.fn().mockRejectedValue(new Error("SMTP connection refused")),
    };
    const service = new NotificationService(mockEmailService as unknown as EmailService);

    await expect(
      service.createAndEmail(
        defaultRecipient,
        "Test title",
        "Test message",
        "/test-url",
        NotificationType.INFO,
      ),
    ).resolves.toBeUndefined();

    expect(mockCreateNotification).toHaveBeenCalled();
    expect(mockEmailService.sendNotificationEmail).toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Failed to send notification email",
      expect.objectContaining({
        recipientEmail: "user@example.com",
        recipientId: "user-1",
        title: "Test title",
        error: "SMTP connection refused",
      }),
    );
  });

  it("creates notification and logs error when email throws non-Error", async () => {
    const mockEmailService = {
      sendNotificationEmail: vi.fn().mockRejectedValue("string error"),
    };
    const service = new NotificationService(mockEmailService as unknown as EmailService);

    await expect(
      service.createAndEmail(
        defaultRecipient,
        "Test title",
        "Test message",
      ),
    ).resolves.toBeUndefined();

    expect(mockCreateNotification).toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Failed to send notification email",
      expect.objectContaining({
        error: "string error",
      }),
    );
  });

  it("creates notification even when email throws for question submission flow", async () => {
    const mockEmailService = {
      sendNotificationEmail: vi.fn().mockRejectedValue(new Error("SMTP connection refused")),
    };
    const service = new NotificationService(mockEmailService as unknown as EmailService);

    await service.createAndEmail(
      { id: "mod-1", email: "moderator@example.com", name: "Moderator" },
      "Question submitted for CS501",
      "A new question has been submitted by Contributor in Algorithms - Module 2.",
      "/dashboard/moderator/questions",
      NotificationType.ACTION_REQUIRED,
    );

    expect(mockCreateNotification).toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("creates notification even when email throws for moderation flow", async () => {
    const mockEmailService = {
      sendNotificationEmail: vi.fn().mockRejectedValue(new Error("SMTP unavailable")),
    };
    const service = new NotificationService(mockEmailService as unknown as EmailService);

    await service.createAndEmail(
      { id: "contrib-1", email: "contributor@example.com", name: "Contributor" },
      "Question approved",
      "Your question for Module 2, 5-mark Slot 3 was approved.",
      "/dashboard/contributor/questions",
      NotificationType.SUCCESS,
    );

    expect(mockCreateNotification).toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalled();
  });
});
