import { BullModule } from '@nestjs/bullmq'; import { Global, Module } from '@nestjs/common'; import { JobsService } from './jobs.service'; import { NotificationProcessor } from './notification.processor';
@Global() @Module({ imports: [BullModule.registerQueue({ name: 'notifications' })], providers: [JobsService, NotificationProcessor], exports: [JobsService] }) export class JobsModule {}
