export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  sendEmail(to: string, subject: string, html: string, text: string): Promise<EmailSendResult>;
}
