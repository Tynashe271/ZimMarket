import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { ComplianceModule } from '../compliance/compliance.module';
@Module({ 
  imports: [ComplianceModule],
  controllers: [BusinessesController], 
  providers: [BusinessesService] 
})
export class BusinessesModule {}
