export interface EmailProvider {
  send(input: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(input: { to: string; subject: string; html: string; text?: string }) {
    console.info("Email dispatch", input);
  }
}
