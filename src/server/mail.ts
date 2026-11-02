import nodemailer from 'nodemailer';

export interface MailMessage { to: string; subject: string; text: string }
export interface MailTransport { send(message: MailMessage): Promise<void> }

/** Email goes out only when an SMTP server and a sender address are both configured. */
export const mailConfigured = () => !!(process.env.SMTP_URL && process.env.MAIL_FROM);

/** Plain-text mail over SMTP (any provider: `smtp://user:pass@host:587`, `smtps://…:465`). */
export function smtpTransport(): MailTransport {
  const transporter = nodemailer.createTransport({
    url: process.env.SMTP_URL,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return {
    async send(message) {
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        replyTo: process.env.MAIL_REPLY_TO || undefined,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    },
  };
}
