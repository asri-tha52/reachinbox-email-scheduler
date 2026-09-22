import nodemailer, { Transporter } from 'nodemailer';
import config from '../../config';

let transporterPromise: Promise<Transporter> | null = null;

export async function getMailerTransporter(): Promise<Transporter> {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    let user = config.ETHEREAL_USER;
    let pass = config.ETHEREAL_PASSWORD;

    // If no credentials provided, dynamically generate a free Ethereal account
    if (!user || !pass) {
      console.log('ℹ️ Generating ephemeral Ethereal SMTP credentials for testing...');
      try {
        const testAccount = await nodemailer.createTestAccount();
        user = testAccount.user;
        pass = testAccount.pass;
        console.log(`✅ Ethereal account created: ${user}`);
      } catch (err: any) {
        console.error('⚠️ Could not generate Ethereal account, falling back to config:', err.message);
      }
    }

    const transporter = nodemailer.createTransport({
      host: config.ETHEREAL_HOST,
      port: config.ETHEREAL_PORT,
      secure: config.ETHEREAL_PORT === 465,
      auth: {
        user,
        pass,
      },
    });

    try {
      await transporter.verify();
      console.log('✅ Ethereal SMTP transporter verified successfully');
    } catch (err: any) {
      console.warn('⚠️ Ethereal transporter verify notice:', err.message);
    }

    return transporter;
  })();

  return transporterPromise;
}

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | null;
}

export async function sendEmailViaEthereal(options: SendMailOptions): Promise<SendMailResult> {
  const transporter = await getMailerTransporter();

  const info = await transporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  return {
    messageId: info.messageId,
    previewUrl: previewUrl ? String(previewUrl) : null,
  };
}
