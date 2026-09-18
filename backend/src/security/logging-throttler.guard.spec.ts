import { ExecutionContext } from '@nestjs/common';
import { LoggingThrottlerGuard } from './logging-throttler.guard';

function makeGuard(fraud: { rateLimitExceeded: jest.Mock }) {
  const options = { throttlers: [{ ttl: 60_000, limit: 10 }] };
  const storageService = {};
  const reflector = { getAllAndOverride: jest.fn() };
  return new LoggingThrottlerGuard(options as never, storageService as never, reflector as never, fraud as never);
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
});
