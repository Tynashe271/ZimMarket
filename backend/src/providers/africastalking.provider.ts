import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider, SmsSendResult } from './sms-provider.interface';

// Africa's Talking SMS API (https://developers.africastalking.com/docs/sms/sending/bulk).
// Sandbox apps (username "sandbox") must use the sandbox host; live apps use the production host.
const LIVE_URL = 'https://api.africastalking.com/version1/messaging';
const SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1/messaging';

interface AfricasTalkingRecipient {
  number: string;
  status: string;
  statusCode: number;
  messageId?: string;
  cost?: string;
}

interface AfricasTalkingResponse {
  SMSMessageData?: { Message: string; Recipients: AfricasTalkingRecipient[] };
}

@Injectable()
export class AfricasTalkingProvider implements SmsProvider {
  private readonly logger = new Logger(AfricasTalkingProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return this.config.getOrThrow<string>('AFRICASTALKING_API_KEY');
  }

  private get username(): string {
    return this.config.getOrThrow<string>('AFRICASTALKING_USERNAME');
  }

  async sendSms(to: string, message: string): Promise<SmsSendResult> {
    const username = this.username;
    const url = username === 'sandbox' ? SANDBOX_URL : LIVE_URL;
    const senderId = this.config.get<string>('AFRICASTALKING_SENDER_ID');
    const body = new URLSearchParams({ username, to, message, ...(senderId ? { from: senderId } : {}) });

    let data: AfricasTalkingResponse;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          apiKey: this.apiKey,
        },
        body: body.toString(),
      });
      data = (await response.json()) as AfricasTalkingResponse;
    } catch {
      this.logger.error('Africa\'s Talking request failed to reach the gateway');
      return { success: false, error: 'Could not reach the SMS provider' };
    }

    const recipient = data.SMSMessageData?.Recipients?.[0];
    if (!recipient) {
      return { success: false, error: data.SMSMessageData?.Message || 'SMS provider returned no recipient status' };
    }
    if (recipient.statusCode !== 101 && recipient.status.toLowerCase() !== 'success') {
      this.logger.warn(`Africa's Talking rejected the message: ${recipient.status}`);
      return { success: false, error: recipient.status };
    }
    return { success: true, messageId: recipient.messageId };
  }
}
