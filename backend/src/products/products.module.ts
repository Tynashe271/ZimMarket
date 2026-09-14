import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({ 
  imports: [ComplianceModule],
  controllers: [ProductsController], 
  providers: [ProductsService] 
})
export class ProductsModule {}
