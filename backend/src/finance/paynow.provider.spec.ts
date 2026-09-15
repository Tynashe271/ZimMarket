import { createHash } from 'crypto';
import { PaynowProvider } from './paynow.provider';

const INTEGRATION_KEY = '11111111-2222-3333-4444-555555555555';

function signResponse(fields: Record<string, string>): string {
  const concat = Object.values(fields).map(v => v.trim()).join('') + INTEGRATION_KEY;
  const hash = createHash('sha512').update(concat, 'utf8').digest('hex').toUpperCase();
  return new URLSearchParams({ ...fields, hash }).toString();
}

function makeProvider() {
  const config = { getOrThrow: jest.fn((key: string) => (key === 'PAYNOW_INTEGRATION_ID' ? 'ID123' : INTEGRATION_KEY)) };
  return new PaynowProvider(config as never);
}

describe('PaynowProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns a browser/poll url when Paynow accepts the transaction', async () => {
    const provider = makeProvider();
    const responseBody = signResponse({ status: 'Ok', browserurl: 'https://paynow.co.zw/pay/abc', pollurl: 'https://paynow.co.zw/poll/abc' });
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ text: () => Promise.resolve(responseBody) } as never);

    const result = await provider.initiateWebCheckout({
      reference: 'ref-1', amount: 10, additionalInfo: 'Order #1', authEmail: 'a@b.com',
      returnUrl: 'https://app/return', resultUrl: 'https://api/result',
    });

    expect(result).toEqual({ success: true, browserUrl: 'https://paynow.co.zw/pay/abc', pollUrl: 'https://paynow.co.zw/poll/abc' });
  });

  it('rejects when the response hash does not match', async () => {
    const provider = makeProvider();
    const tampered = new URLSearchParams({ status: 'Ok', browserurl: 'https://evil', pollurl: 'https://evil', hash: 'DEADBEEF' }).toString();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ text: () => Promise.resolve(tampered) } as never);

    const result = await provider.initiateWebCheckout({
      reference: 'ref-1', amount: 10, additionalInfo: 'Order #1', authEmail: 'a@b.com',
      returnUrl: 'https://app/return', resultUrl: 'https://api/result',
    });

    expect(result.success).toBe(false);
  });

  it('surfaces the provider error when Paynow rejects the transaction', async () => {
    const provider = makeProvider();
    const responseBody = new URLSearchParams({ status: 'Error', error: 'Invalid integration id' }).toString();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ text: () => Promise.resolve(responseBody) } as never);

    const result = await provider.initiateWebCheckout({
      reference: 'ref-1', amount: 10, additionalInfo: 'Order #1', authEmail: 'a@b.com',
      returnUrl: 'https://app/return', resultUrl: 'https://api/result',
    });

    expect(result).toEqual({ success: false, error: 'Invalid integration id' });
  });

  it('accepts a correctly-signed result callback and reports it as paid', () => {
    const provider = makeProvider();
    const fields = Object.fromEntries(new URLSearchParams(signResponse({ reference: 'ref-1', paynowreference: 'PN-9', amount: '10.00', status: 'Paid' })).entries());

    const result = provider.verifyResultCallback(fields);

    expect(result).toEqual({ success: true, reference: 'ref-1', paynowReference: 'PN-9', status: 'paid', paid: true, failed: false });
  });

  it('rejects a result callback with an invalid signature', () => {
    const provider = makeProvider();
    const result = provider.verifyResultCallback({ reference: 'ref-1', status: 'Paid', hash: 'not-a-real-hash' });
    expect(result.success).toBe(false);
  });
});
