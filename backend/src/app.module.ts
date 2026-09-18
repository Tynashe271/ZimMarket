import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: config.get<string>('REDIS_URL')
          ? new Redis(config.get<string>('REDIS_URL')!, { maxRetriesPerRequest: null })
          : {
              host: config.get('REDIS_HOST', 'localhost'),
              port: config.get<number>('REDIS_PORT', 6380),
            },
      }),
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
