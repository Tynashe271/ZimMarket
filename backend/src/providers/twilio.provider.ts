import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider, SmsSendResult } from './sms-provider.interface';

// Twilio Programmable Messaging API (https://www.twilio.com/docs/sms/api/message-resource).
const TWILIO_BASE_URL = 'https://api.twilio.com/2010-04-01';

interface TwilioMessageResponse {
  sid?: string;
  error_code?: number | null;
  error_message?: string | null;
  message?: string;
}

@Injectable()
export class TwilioProvider implements SmsProvider {
  private readonly logger = new Logger(TwilioProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get accountSid(): string {
    return this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
  }

  private get authToken(): string {
    return this.config.getOrThrow<string>('TWILIO_AUTH_TOKEN');
  }

  async sendSms(to: string, message: string): Promise<SmsSendResult> {
    const messagingServiceSid = this.config.get<string>('TWILIO_MESSAGING_SERVICE_SID');
    const fromNumber = this.config.get<string>('TWILIO_FROM_NUMBER');
    const body = new URLSearchParams({
      To: to,
      Body: message,
      ...(messagingServiceSid ? { MessagingServiceSid: messagingServiceSid } : fromNumber ? { From: fromNumber } : {}),
    });

    let ok: boolean;
    let data: TwilioMessageResponse;
    try {
      const response = await fetch(`${TWILIO_BASE_URL}/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        },
        body: body.toString(),
      });
      ok = response.ok;
      data = (await response.json()) as TwilioMessageResponse;
    } catch {
      this.logger.error('Twilio request failed to reach the gateway');
      return { success: false, error: 'Could not reach the SMS provider' };
    }

    if (!ok || data.error_code) {
      this.logger.warn(`Twilio rejected the message: ${data.error_message || data.message}`);
      return { success: false, error: data.error_message || data.message || 'SMS provider rejected the message' };
    }
    return { success: true, messageId: data.sid };
  }
}
