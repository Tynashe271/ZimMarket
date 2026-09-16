export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  sendSms(to: string, message: string): Promise<SmsSendResult>;
}
