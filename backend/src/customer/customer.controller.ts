import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/current-user.decorator';
import { CustomerService } from './customer.service';

@Controller('customer')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(private readonly service: CustomerService) {}
  @Get('workspace') workspace(@CurrentUser() user: AuthUser) {
    return this.service.workspace(user.userId, user.accountType);
  }
}
