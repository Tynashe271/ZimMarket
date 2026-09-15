import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { PaynowProvider } from './paynow.provider';
@Module({ controllers: [FinanceController], providers: [FinanceService, PaynowProvider] })
export class FinanceModule {}
