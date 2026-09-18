import { ResendProvider } from './resend.provider';

function makeProvider() {
  const config = {
    getOrThrow: jest.fn((key: string) => (key === 'RESEND_API_KEY' ? 're_test_key' : 'ZimMarket <notifications@zimmarket.local>')),
  };
  return new ResendProvider(config as never);
}

describe('ResendProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports success when Resend accepts the message', async () => {
    const provider = makeProvider();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 're_abc123' }),
    } as never);

    const result = await provider.sendEmail('customer@example.com', 'Your code', '<p>123456</p>', '123456');

    expect(result).toEqual({ success: true, messageId: 're_abc123' });
  });

  it('surfaces the provider error when Resend rejects the message', async () => {
    const provider = makeProvider();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Invalid `from` address' }),
    } as never);

    const result = await provider.sendEmail('customer@example.com', 'Your code', '<p>123456</p>', '123456');

    expect(result).toEqual({ success: false, error: 'Invalid `from` address' });
  });

  it('reports failure when the gateway cannot be reached', async () => {
    const provider = makeProvider();
    jest.spyOn(global, 'fetch' as never).mockRejectedValue(new Error('network down') as never);

    const result = await provider.sendEmail('customer@example.com', 'Your code', '<p>123456</p>', '123456');

    expect(result.success).toBe(false);
  });
});
