import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export interface RlsContext { userId?: string; accountType?: string }

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }

  // Runs `fn` with Postgres session variables set for the row-level security
  // policies on User/Order/Payment/Message to key off (see prisma/migrations
  // .../rls.sql). Each call opens its own short transaction so the setting only
  // ever applies to that one unit of work, never leaking onto a pooled connection
  // some unrelated later query might reuse.
  withContext<T>(context: RlsContext, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<T> {
    return this.$transaction(async tx => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.user_id', $1, true), set_config('app.account_type', $2, true), set_config('app.bypass_rls', 'false', true)`,
        context.userId ?? '',
        context.accountType ?? '',
      );
      return fn(tx);
    }, options);
  }

  // For pre-authentication (register/login/refresh/password-reset), webhook
  // (Paynow), and background (BullMQ/cron) code paths that legitimately have no
  // per-user session to scope by. Kept to the small set of call sites that
  // genuinely need it, rather than a blanket bypass role, so it stays auditable.
  withSystemContext<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<T> {
    return this.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'true', true)`);
      return fn(tx);
    }, options);
  }
}
