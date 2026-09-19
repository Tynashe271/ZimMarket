import { ExecutionContext } from '@nestjs/common';
import { LoggingThrottlerGuard } from './logging-throttler.guard';

function makeGuard(fraud: { rateLimitExceeded: jest.Mock }, jwt: { verifyAsync: jest.Mock } = { verifyAsync: jest.fn().mockRejectedValue(new Error('no token')) }) {
  const options = { throttlers: [{ ttl: 60_000, limit: 10 }] };
  const storageService = {};
  const reflector = { getAllAndOverride: jest.fn() };
  return new LoggingThrottlerGuard(options as never, storageService as never, reflector as never, fraud as never, jwt as never);
}

function makeContext(request: { originalUrl?: string; method?: string }) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('LoggingThrottlerGuard', () => {
  it('logs a fraud signal before throwing the throttling exception', async () => {
    const fraud = { rateLimitExceeded: jest.fn().mockResolvedValue(undefined) };
    const guard = makeGuard(fraud) as never as { throwThrottlingException: (context: ExecutionContext, detail: unknown) => Promise<void> };
    const context = makeContext({ originalUrl: '/api/v1/auth/login', method: 'POST' });
    const detail = { limit: 10, ttl: 60_000, key: 'k', tracker: '1.2.3.4', totalHits: 11, timeToExpire: 60, isBlocked: true, timeToBlockExpire: 60 };

    await expect(guard.throwThrottlingException(context, detail)).rejects.toThrow();

    expect(fraud.rateLimitExceeded).toHaveBeenCalledWith('1.2.3.4', '/api/v1/auth/login', 'POST', 11, 10);
  });

  it('falls back to "unknown" when the request has no URL or method', async () => {
    const fraud = { rateLimitExceeded: jest.fn().mockResolvedValue(undefined) };
    const guard = makeGuard(fraud) as never as { throwThrottlingException: (context: ExecutionContext, detail: unknown) => Promise<void> };
    const context = makeContext({});
    const detail = { limit: 10, ttl: 60_000, key: 'k', tracker: '1.2.3.4', totalHits: 11, timeToExpire: 60, isBlocked: true, timeToBlockExpire: 60 };

    await expect(guard.throwThrottlingException(context, detail)).rejects.toThrow();

    expect(fraud.rateLimitExceeded).toHaveBeenCalledWith('1.2.3.4', 'unknown', 'unknown', 11, 10);
  });

  it('tracks authenticated requests by user id from the verified access token, not IP', async () => {
    const fraud = { rateLimitExceeded: jest.fn() };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1' }) };
    const guard = makeGuard(fraud, jwt) as never as { getTracker: (req: unknown) => Promise<string> };

    const tracker = await guard.getTracker({ headers: { authorization: 'Bearer abc.def.ghi' }, ip: '1.2.3.4' });

    expect(jwt.verifyAsync).toHaveBeenCalledWith('abc.def.ghi');
    expect(tracker).toBe('user:user-1');
  });

  it('falls back to IP tracking when there is no valid access token', async () => {
    const fraud = { rateLimitExceeded: jest.fn() };
    const jwt = { verifyAsync: jest.fn().mockRejectedValue(new Error('invalid token')) };
    const guard = makeGuard(fraud, jwt) as never as { getTracker: (req: unknown) => Promise<string> };

    const tracker = await guard.getTracker({ headers: {}, ip: '1.2.3.4' });

    expect(tracker).toBe('1.2.3.4');
  });
});
