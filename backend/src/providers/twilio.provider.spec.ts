import { TwilioProvider } from './twilio.provider';

function makeProvider() {
  const config = {
    getOrThrow: jest.fn((key: string) => (key === 'TWILIO_ACCOUNT_SID' ? 'AC-test' : 'auth-token')),
    get: jest.fn((key: string) => (key === 'TWILIO_FROM_NUMBER' ? '+15005550006' : undefined)),
  };
  return new TwilioProvider(config as never);
}

describe('TwilioProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports success when Twilio accepts the message', async () => {
    const provider = makeProvider();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM123', error_code: null }),
    } as never);

    const result = await provider.sendSms('+263771234567', 'Your code is 123456');

    expect(result).toEqual({ success: true, messageId: 'SM123' });
  });

  it('surfaces the provider error when Twilio rejects the message', async () => {
    const provider = makeProvider();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error_code: 21211, error_message: 'Invalid \'To\' Phone Number' }),
    } as never);

    const result = await provider.sendSms('+263771234567', 'Your code is 123456');

    expect(result).toEqual({ success: false, error: "Invalid 'To' Phone Number" });
  });

  it('reports failure when the gateway cannot be reached', async () => {
    const provider = makeProvider();
    jest.spyOn(global, 'fetch' as never).mockRejectedValue(new Error('network down') as never);

    const result = await provider.sendSms('+263771234567', 'Your code is 123456');

    expect(result.success).toBe(false);
  });
});
