import { env } from "@/lib/env";
import { ConsoleEmailProvider, type EmailProvider } from "@/modules/notifications/email-provider";
import { SmtpEmailProvider } from "@/modules/notifications/smtp-provider";

export class EmailService {
  private readonly provider: EmailProvider;

  constructor(provider?: EmailProvider) {
    this.provider = provider ?? this.createDefaultProvider();
  }

  private createDefaultProvider(): EmailProvider {
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
