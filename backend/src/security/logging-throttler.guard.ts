import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard, ThrottlerLimitDetail, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { FraudService } from './fraud.service';

// Records a FraudSignal whenever a request gets rate-limited, so sustained abuse
// against a throttled endpoint (e.g. credential stuffing) leaves a queryable trail
// instead of only a transient 429 response.
@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly fraud: FraudService,
    private readonly jwt: JwtService,
  ) {
    super(options, storageService, reflector);
  }

  // Authenticated requests are tracked per-user (from the verified access token)
  // rather than per-IP, so the quota follows the account -- not shared/NAT'd IPs --
  // and one user can't dodge it by rotating networks. This guard runs before
  // JwtAuthGuard (it's global), so req.user isn't populated yet; the token is
  // verified here directly. Unauthenticated/invalid-token requests fall back to IP.
  protected async getTracker(req: { headers?: Record<string, string | string[] | undefined>; ip?: string; ips?: string[] }): Promise<string> {
    const header = req.headers?.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
        if (payload.sub) return `user:${payload.sub}`;
      } catch {
        // Invalid/expired token -- fall through to IP tracking; JwtAuthGuard
        // (where applied) will reject the request on its own merits.
      }
    }
    return super.getTracker(req);
  }

  protected async throwThrottlingException(context: ExecutionContext, throttlerLimitDetail: ThrottlerLimitDetail): Promise<void> {
    const request = context.switchToHttp().getRequest<{ originalUrl?: string; method?: string }>();
    await this.fraud.rateLimitExceeded(
      throttlerLimitDetail.tracker,
      request?.originalUrl ?? 'unknown',
      request?.method ?? 'unknown',
      throttlerLimitDetail.totalHits,
      throttlerLimitDetail.limit,
    );
    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
