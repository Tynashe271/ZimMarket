import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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
  ) {
    super(options, storageService, reflector);
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
