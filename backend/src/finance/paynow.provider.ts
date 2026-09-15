import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';

// Paynow Zimbabwe API (https://developers.paynow.co.zw). Hash algorithm: concatenate every
// field value except "hash" in insertion order (trimmed, not URL-encoded), append the
// integration key, SHA512 the result and hex-encode it in upper case.
const PAYNOW_BASE_URL = 'https://www.paynow.co.zw';
const PAID_STATUSES = ['paid', 'awaiting delivery', 'delivered'];
const FAILED_STATUSES = ['cancelled', 'failed', 'disputed'];

export interface PaynowInitiateResult {
  success: boolean;
  browserUrl?: string;
  pollUrl?: string;
  error?: string;
}

export interface PaynowStatusResult {
  success: boolean;
  reference?: string;
  paynowReference?: string;
  status?: string;
  paid: boolean;
  failed: boolean;
  error?: string;
}

@Injectable()
export class PaynowProvider {
  private readonly logger = new Logger(PaynowProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get integrationId(): string {
    return this.config.getOrThrow<string>('PAYNOW_INTEGRATION_ID');
  }

  private get integrationKey(): string {
    return this.config.getOrThrow<string>('PAYNOW_INTEGRATION_KEY');
  }

  private computeHash(fields: Record<string, string>, integrationKey: string): string {
    const concat = Object.entries(fields)
      .filter(([key]) => key.toLowerCase() !== 'hash')
      .map(([, value]) => (value ?? '').toString().trim())
      .join('');
    return createHash('sha512').update(concat + integrationKey, 'utf8').digest('hex').toUpperCase();
  }

  private verifyHash(fields: Record<string, string>, integrationKey: string): boolean {
    const supplied = Buffer.from((fields.hash ?? '').toUpperCase());
    const expected = Buffer.from(this.computeHash(fields, integrationKey));
    return supplied.length === expected.length && supplied.length > 0 && timingSafeEqual(supplied, expected);
  }

  private parseResponse(body: string): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(body).entries());
  }

  private interpretStatus(data: Record<string, string>): PaynowStatusResult {
    const status = (data.status ?? '').toLowerCase();
    return {
      success: true,
      reference: data.reference,
      paynowReference: data.paynowreference,
      status,
      paid: PAID_STATUSES.includes(status),
      failed: FAILED_STATUSES.includes(status),
    };
  }

  async initiateWebCheckout(params: {
    reference: string;
    amount: number;
    additionalInfo: string;
    authEmail: string;
    returnUrl: string;
    resultUrl: string;
  }): Promise<PaynowInitiateResult> {
    const integrationKey = this.integrationKey;
    const fields: Record<string, string> = {
      resulturl: params.resultUrl,
      returnurl: params.returnUrl,
      reference: params.reference,
      amount: params.amount.toFixed(2),
      id: this.integrationId,
      additionalinfo: params.additionalInfo,
      authemail: params.authEmail,
      status: 'Message',
    };
    const hash = this.computeHash(fields, integrationKey);

    let text: string;
    try {
      const response = await fetch(`${PAYNOW_BASE_URL}/interface/initiatetransaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...fields, hash }).toString(),
      });
      text = await response.text();
    } catch {
      this.logger.error('Paynow initiate request failed to reach the gateway');
      return { success: false, error: 'Could not reach the payment provider' };
    }

    const data = this.parseResponse(text);
    if ((data.status ?? '').toLowerCase() !== 'ok') {
      this.logger.warn(`Paynow rejected the transaction: ${data.error ?? 'unknown error'}`);
      return { success: false, error: data.error ?? 'Payment provider rejected the transaction' };
    }
    if (!this.verifyHash(data, integrationKey)) {
      this.logger.error('Paynow initiate response failed hash verification');
      return { success: false, error: 'Payment provider response could not be verified' };
    }
    return { success: true, browserUrl: data.browserurl, pollUrl: data.pollurl };
  }

  async pollStatus(pollUrl: string): Promise<PaynowStatusResult> {
    let text: string;
    try {
      const response = await fetch(pollUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      text = await response.text();
    } catch {
      return { success: false, paid: false, failed: false, error: 'Could not reach the payment provider' };
    }
    const data = this.parseResponse(text);
    if (!this.verifyHash(data, this.integrationKey)) {
      return { success: false, paid: false, failed: false, error: 'Payment provider response could not be verified' };
    }
    return this.interpretStatus(data);
  }

  verifyResultCallback(fields: Record<string, string>): PaynowStatusResult {
    if (!this.verifyHash(fields, this.integrationKey)) {
      return { success: false, paid: false, failed: false, error: 'Invalid Paynow callback signature' };
    }
    return this.interpretStatus(fields);
  }
}
