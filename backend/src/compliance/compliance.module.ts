import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StoreRestrictionService } from './store-restriction.service';
import { ComplianceAuditService } from './compliance-audit.service';
import { ZimraIntegrationService } from './zimra-integration.service';

@Module({
  imports: [PrismaModule],
  controllers: [ComplianceController],
  providers: [
    ComplianceService,
    StoreRestrictionService,
    ComplianceAuditService,
    ZimraIntegrationService,
  ],
  exports: [
    ComplianceService,
    StoreRestrictionService,
    ComplianceAuditService,
  ],
})
export class ComplianceModule {}
