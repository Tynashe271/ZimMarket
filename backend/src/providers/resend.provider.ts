import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider, EmailSendResult } from './email-provider.interface';

// Resend transactional email API (https://resend.com/docs/api-reference/emails/send-email).
const RESEND_URL = 'https://api.resend.com/emails';

interface ResendResponse {
  id?: string;
  message?: string;
  name?: string;
}

@Injectable()
export class ResendProvider implements EmailProvider {
  private readonly logger = new Logger(ResendProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return this.config.getOrThrow<string>('RESEND_API_KEY');
  }

  private get fromAddress(): string {
    return this.config.getOrThrow<string>('EMAIL_FROM_ADDRESS');
  }

  async sendEmail(to: string, subject: string, html: string, text: string): Promise<EmailSendResult> {
    let ok: boolean;
    let data: ResendResponse;
    try {
      const response = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ from: this.fromAddress, to, subject, html, text }),
      });
      ok = response.ok;
      data = (await response.json()) as ResendResponse;
    } catch {
      this.logger.error('Resend request failed to reach the gateway');
      return { success: false, error: 'Could not reach the email provider' };
    }

    if (!ok || !data.id) {
      this.logger.warn(`Resend rejected the message: ${data.message || 'unknown error'}`);
      return { success: false, error: data.message || 'Email provider rejected the message' };
    }
    return { success: true, messageId: data.id };
  }
}
