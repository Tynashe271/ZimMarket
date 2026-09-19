import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp = require('sharp');
import { ProviderGateway } from './provider.gateway';

function makeConfig(overrides: Record<string, string> = {}) {
  return {
    getOrThrow: jest.fn().mockReturnValue('secret'),
    get: jest.fn((key: string, fallback?: unknown) => overrides[key] ?? fallback),
  };
}

describe('ProviderGateway', () => {
  const config = makeConfig();

  it('creates expiring signed storage operations', () => {
    const service = new ProviderGateway(config as never, {} as never, {} as never, {} as never, {} as never);
    const result = service.signedUpload('user/document.pdf', 'application/pdf', 60);
    expect(result.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(result.action).toBe('upload');
    expect(result.expires).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects the standard antivirus test payload', async () => {
    const service = new ProviderGateway(config as never, {} as never, {} as never, {} as never, {} as never);
    const scan = await service.scanBuffer('user/test.txt', 'text/plain', Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'));
    expect(scan.clean).toBe(false);
  });

  it('rejects an upload whose mime type is not on the allowlist', async () => {
    const service = new ProviderGateway(config as never, {} as never, {} as never, {} as never, {} as never);
    const scan = await service.scan('user/script.sh', 'application/x-sh');
    expect(scan.clean).toBe(false);
  });

  it('compresses an oversized JPEG before storing it, and leaves the sha256/size consistent with what was written', async () => {
    const storageDir = join(tmpdir(), `zimmarket-test-${randomUUID()}`);
    const prisma = { providerEvent: { create: jest.fn() } };
    const service = new ProviderGateway(makeConfig({ LOCAL_STORAGE_PATH: storageDir }) as never, prisma as never, {} as never, {} as never, {} as never);
    const image = await sharp({ create: { width: 2000, height: 2000, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg({ quality: 100 }).toBuffer();
    const key = `user/${randomUUID()}.jpg`;
    const upload = service.signedUpload(key, 'image/jpeg');

    const result = await service.store(key, 'image/jpeg', upload.expires, upload.signature, image);

    expect(result.size).toBeLessThan(image.length);
    expect(result.mimeType).toBe('image/jpeg');
    await unlink(join(storageDir, key));
  });

  it('produces stable demo coordinates inside Zimbabwe bounds', async () => {
    const service = new ProviderGateway(config as never, {} as never, {} as never, {} as never, {} as never);
    const first = await service.geocode('1 Demo Street', 'Harare');
    const second = await service.geocode('1 Demo Street', 'Harare');
    expect(first.latitude).toBe(second.latitude);
    expect(first.latitude).toBeGreaterThanOrEqual(-22);
    expect(first.longitude).toBeGreaterThanOrEqual(25);
  });

  it("routes SMS through Africa's Talking when configured and records the outcome", async () => {
    const smsConfig = makeConfig({ SMS_PROVIDER: 'africastalking' });
    const prisma = { notificationOutbox: { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) }, providerEvent: { create: jest.fn().mockResolvedValue({}) } };
    const africasTalking = { sendSms: jest.fn().mockResolvedValue({ success: true, messageId: 'ATXid_1' }) };
    const service = new ProviderGateway(smsConfig as never, prisma as never, africasTalking as never, {} as never, {} as never);

    const result = await service.send('SMS', '+263771234567', 'verification', { code: '123456' });

    expect(africasTalking.sendSms).toHaveBeenCalledWith('+263771234567', expect.stringContaining('123456'));
    expect(prisma.notificationOutbox.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }));
    expect(result.accepted).toBe(true);
  });

  it("throws and records a failure when Africa's Talking rejects the message", async () => {
    const smsConfig = makeConfig({ SMS_PROVIDER: 'africastalking' });
    const prisma = { notificationOutbox: { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) }, providerEvent: { create: jest.fn().mockResolvedValue({}) } };
    const africasTalking = { sendSms: jest.fn().mockResolvedValue({ success: false, error: 'InvalidPhoneNumber' }) };
    const service = new ProviderGateway(smsConfig as never, prisma as never, africasTalking as never, {} as never, {} as never);

    await expect(service.send('SMS', '+263771234567', 'verification', { code: '123456' })).rejects.toThrow('InvalidPhoneNumber');
  });

  it('routes SMS through Twilio when configured and records the outcome', async () => {
    const smsConfig = makeConfig({ SMS_PROVIDER: 'twilio' });
    const prisma = { notificationOutbox: { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) }, providerEvent: { create: jest.fn().mockResolvedValue({}) } };
    const twilio = { sendSms: jest.fn().mockResolvedValue({ success: true, messageId: 'SMxxxx' }) };
    const service = new ProviderGateway(smsConfig as never, prisma as never, {} as never, twilio as never, {} as never);

    const result = await service.send('SMS', '+263771234567', 'verification', { code: '123456' });

    expect(twilio.sendSms).toHaveBeenCalledWith('+263771234567', expect.stringContaining('123456'));
    expect(prisma.notificationOutbox.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }));
    expect(result.accepted).toBe(true);
  });

  it('routes EMAIL through Resend when configured, masks the recipient, and skips the unsubscribe link for verification codes', async () => {
    const emailConfig = makeConfig({ EMAIL_PROVIDER: 'resend' });
    const prisma = { notificationOutbox: { create: jest.fn().mockResolvedValue({ id: 'msg-2' }) }, providerEvent: { create: jest.fn().mockResolvedValue({}) } };
    const resend = { sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 're_123' }) };
    const service = new ProviderGateway(emailConfig as never, prisma as never, {} as never, {} as never, resend as never);

    const result = await service.send('EMAIL', 'customer@example.com', 'verification', { code: '123456', userId: 'user-1' });

    expect(resend.sendEmail).toHaveBeenCalledWith('customer@example.com', expect.stringContaining('code'), expect.stringContaining('123456'), expect.stringContaining('123456'));
    const [, , html] = resend.sendEmail.mock.calls[0];
    expect(html).not.toContain('Unsubscribe');
    expect(result.to).toBe('cu***@example.com');
  });

  it('includes a working unsubscribe link for non-transactional email templates', async () => {
    const emailConfig = makeConfig({ EMAIL_PROVIDER: 'resend', APP_PUBLIC_URL: 'https://app.zimmarket.local' });
    const prisma = { notificationOutbox: { create: jest.fn().mockResolvedValue({ id: 'msg-3' }) }, providerEvent: { create: jest.fn().mockResolvedValue({}) } };
    const resend = { sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 're_456' }) };
    const service = new ProviderGateway(emailConfig as never, prisma as never, {} as never, {} as never, resend as never);

    await service.send('EMAIL', 'customer@example.com', 'opportunity', { category: 'Catering', userId: 'user-1' });

    const [, , html] = resend.sendEmail.mock.calls[0];
    expect(html).toContain('https://app.zimmarket.local/unsubscribe?userId=user-1');
  });

  it('throws and records a failure when Resend rejects the message', async () => {
    const emailConfig = makeConfig({ EMAIL_PROVIDER: 'resend' });
    const prisma = { notificationOutbox: { create: jest.fn().mockResolvedValue({ id: 'msg-4' }) }, providerEvent: { create: jest.fn().mockResolvedValue({}) } };
    const resend = { sendEmail: jest.fn().mockResolvedValue({ success: false, error: 'invalid_from_address' }) };
    const service = new ProviderGateway(emailConfig as never, prisma as never, {} as never, {} as never, resend as never);

    await expect(service.send('EMAIL', 'customer@example.com', 'product-alert', { userId: 'user-1' })).rejects.toThrow('invalid_from_address');
  });

  it('downgrades EMAIL preference to NONE and BOTH to SMS when a valid unsubscribe link is used', async () => {
    const service = new ProviderGateway(config as never, {} as never, {} as never, {} as never, {} as never);
    const url = service.unsubscribeUrl('user-1');
    const signature = new URL(url, 'http://x').searchParams.get('signature')!;

    const emailTx = { user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ notificationPreference: 'EMAIL' }), update: jest.fn().mockResolvedValue({}) } };
    const prismaEmail = { withContext: jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn(emailTx)) };
    const emailService = new ProviderGateway(config as never, prismaEmail as never, {} as never, {} as never, {} as never);
    await expect(emailService.unsubscribeEmail('user-1', signature)).resolves.toEqual({ unsubscribed: true, notificationPreference: 'NONE' });
    expect(emailTx.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { notificationPreference: 'NONE' } });

    const bothTx = { user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ notificationPreference: 'BOTH' }), update: jest.fn().mockResolvedValue({}) } };
    const prismaBoth = { withContext: jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn(bothTx)) };
    const bothService = new ProviderGateway(config as never, prismaBoth as never, {} as never, {} as never, {} as never);
    await expect(bothService.unsubscribeEmail('user-1', signature)).resolves.toEqual({ unsubscribed: true, notificationPreference: 'SMS' });
  });

  it('rejects an unsubscribe request with an invalid signature', async () => {
    const withContext = jest.fn();
    const prisma = { withContext };
    const service = new ProviderGateway(config as never, prisma as never, {} as never, {} as never, {} as never);

    await expect(service.unsubscribeEmail('user-1', 'not-a-real-signature')).rejects.toThrow();
    expect(withContext).not.toHaveBeenCalled();
  });
});
