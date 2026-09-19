import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import { LoggingThrottlerGuard } from './security/logging-throttler.guard';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { BusinessesModule } from './businesses/businesses.module';
import { OrdersModule } from './orders/orders.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { FinanceModule } from './finance/finance.module';
import { AdminModule } from './admin/admin.module';
import { PrivacyModule } from './privacy/privacy.module';
import { CustomerModule } from './customer/customer.module';
import { JobsModule } from './jobs/jobs.module';
import { OperationsModule } from './operations/operations.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { ExperienceModule } from './experience/experience.module';
import { GrowthModule } from './growth/growth.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CouriersModule } from './couriers/couriers.module';
import { ProvidersModule } from './providers/providers.module';
import { SecurityModule } from './security/security.module';
import { ReportsModule } from './reports/reports.module';
import { AssistantModule } from './assistant/assistant.module';
import { ComplianceModule } from './compliance/compliance.module';

// Shared by BullMQ and the rate-limiter storage below -- both need their own
// ioredis connection to the same Redis, since a rate limit backed by
// per-instance memory (the @nestjs/throttler default) becomes N-times too
// permissive across N Cloud Run instances and resets on every scale event.
function redisClient(config: ConfigService): Redis {
  return config.get<string>('REDIS_URL')
    ? new Redis(config.get<string>('REDIS_URL')!, { maxRetriesPerRequest: null })
    : new Redis({ host: config.get('REDIS_HOST', 'localhost'), port: config.get<number>('REDIS_PORT', 6380), maxRetriesPerRequest: null });
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // In-memory (per-instance) cache for read-heavy public endpoints -- see
    // CacheInterceptor usage on public/products, public/businesses,
    // public/services, public/ads. Not shared across instances, which is fine
    // for a short TTL on data that's public and non-personalized anyway.
    CacheModule.register({ isGlobal: true, ttl: 30_000 }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(redisClient(config)),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: redisClient(config) }),
    }),
    PrismaModule,
    SubscriptionsModule,
    ProvidersModule,
    SecurityModule,
    CouriersModule,
    ReportsModule,
    JobsModule,
    AuthModule,
    ProductsModule,
    BusinessesModule,
    OrdersModule,
    MarketplaceModule,
    FinanceModule,
    AdminModule,
    PrivacyModule,
    CustomerModule,
    OperationsModule,
    OpportunitiesModule,
    ExperienceModule,
    GrowthModule,
    AssistantModule,
    ComplianceModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: LoggingThrottlerGuard }],
})
export class AppModule {}
