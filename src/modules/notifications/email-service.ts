import { ConsoleEmailProvider, type EmailProvider } from "@/modules/notifications/email-provider";

export class EmailService {
  constructor(private readonly provider: EmailProvider = new ConsoleEmailProvider()) {}

  sendNotificationEmail(to: string, subject: string, body: string) {
    return this.provider.send({
      to,
      subject,
      html: `<p>${body}</p>`,
      text: body,
    });
  }
}
