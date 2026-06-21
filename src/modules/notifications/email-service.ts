import { env } from "@/lib/env";
import { SecurityConfig } from "@/lib/auth/security-config";
import { ConsoleEmailProvider, type EmailProvider } from "@/modules/notifications/email-provider";
import { SmtpEmailProvider } from "@/modules/notifications/smtp-provider";
import { AppError } from "@/lib/errors";

export class EmailService {
  private readonly provider: EmailProvider;

  constructor(provider?: EmailProvider) {
    this.provider = provider ?? this.createDefaultProvider();
  }

  private createDefaultProvider(): EmailProvider {
    const cfg = SecurityConfig.getInstance();

    // Production mode: SMTP is REQUIRED — no silent console fallback for OTP security
    if (cfg.mode === "production" || cfg.mode === "lockdown") {
      if (!env.SMTP_HOST || !env.SMTP_USER) {
        throw new AppError(
          "SMTP is not configured. Email delivery is required in production mode. Set SMTP_HOST and SMTP_USER env vars.",
          500,
          "SMTP_NOT_CONFIGURED",
        );
      }
      return new SmtpEmailProvider();
    }

    // Development mode: console fallback is fine
    if (env.SMTP_HOST && env.SMTP_USER) {
      return new SmtpEmailProvider();
    }
    return new ConsoleEmailProvider();
  }

  sendNotificationEmail(to: string, subject: string, body: string) {
    return this.provider.send({
      to,
      subject,
      html: `<p>${body}</p>`,
      text: body,
    });
  }
}
