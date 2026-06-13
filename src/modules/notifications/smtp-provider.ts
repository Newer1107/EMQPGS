import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import type { EmailProvider } from "@/modules/notifications/email-provider";

export class SmtpEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;

  constructor() {
    const hasOAuth2 = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: hasOAuth2
        ? {
            type: "OAuth2",
            user: env.SMTP_USER,
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            refreshToken: env.GOOGLE_REFRESH_TOKEN,
          }
        : {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
    });
  }

  async send(input: { to: string; subject: string; html: string; text?: string }) {
    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  }
}
