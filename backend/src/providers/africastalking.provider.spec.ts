import { AfricasTalkingProvider } from './africastalking.provider';

function makeProvider(username = 'zimmarket') {
  const config = {
    getOrThrow: jest.fn((key: string) => (key === 'AFRICASTALKING_USERNAME' ? username : 'test-api-key')),
    get: jest.fn(() => undefined),
  };
  return new AfricasTalkingProvider(config as never);
}

describe('AfricasTalkingProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports success when Africa\'s Talking accepts the message', async () => {
    const provider = makeProvider();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      json: () => Promise.resolve({ SMSMessageData: { Message: 'Sent', Recipients: [{ number: '+263771234567', status: 'Success', statusCode: 101, messageId: 'ATXid_123' }] } }),
    } as never);

    const result = await provider.sendSms('+263771234567', 'Your code is 123456');

    expect(result).toEqual({ success: true, messageId: 'ATXid_123' });
  });

  it('surfaces the provider error when the recipient is rejected', async () => {
    const provider = makeProvider();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      json: () => Promise.resolve({ SMSMessageData: { Message: 'Sent', Recipients: [{ number: '+263771234567', status: 'InvalidPhoneNumber', statusCode: 401 }] } }),
    } as never);

    const result = await provider.sendSms('+263771234567', 'Your code is 123456');

    expect(result).toEqual({ success: false, error: 'InvalidPhoneNumber' });
  });

  it('reports failure when the gateway cannot be reached', async () => {
    const provider = makeProvider();
    jest.spyOn(global, 'fetch' as never).mockRejectedValue(new Error('network down') as never);

    const result = await provider.sendSms('+263771234567', 'Your code is 123456');

    expect(result.success).toBe(false);
  });
});
