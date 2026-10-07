import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
    })
  : undefined;

interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  developmentUrl?: string;
}

export const sendMail = async (input: MailInput): Promise<void> => {
  if (!transport) {
    if (env.NODE_ENV === 'production') {
      logger.error({ to: input.to, subject: input.subject }, 'SMTP non configuré.');
      throw new Error('Le service d’envoi des e-mails n’est pas configuré.');
    }
    logger.info(
      { to: input.to, subject: input.subject, developmentUrl: input.developmentUrl },
      'E-mail simulé en développement.',
    );
    return;
  }

  await transport.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
};
