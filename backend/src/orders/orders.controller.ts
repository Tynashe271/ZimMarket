import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsPhoneNumber, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/current-user.decorator';
import { normalizePhone } from '../common/phone';
import { OrdersService } from './orders.service';
class OrderLineDto { @IsUUID() productId!: string; @IsInt() @Min(1) quantity!: number; }
class RecipientDto { @IsString() name!: string; @Transform(({ value }) => normalizePhone(value)) @IsPhoneNumber('ZW') phone!: string; @IsString() address!: string; @IsString() city!: string; }
class CreateOrderDto { @IsArray() @ValidateNested({ each: true }) @Type(() => OrderLineDto) items!: OrderLineDto[]; @IsOptional() @IsUUID() branchId?: string; @IsOptional() @ValidateNested() @Type(() => RecipientDto) recipient?: RecipientDto; }
class StatusDto { @IsEnum(OrderStatus) status!: OrderStatus; }
@Controller('orders') @UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}
  @Post() create(@CurrentUser() u: AuthUser, @Body() d: CreateOrderDto) { return this.service.create(u.userId, u.accountType, d.items, d.branchId, d.recipient); }
  @Get('mine') mine(@CurrentUser() u: AuthUser) { return this.service.listCustomer(u.userId); }
  @Get('business/:businessId') business(@CurrentUser() u: AuthUser, @Param('businessId', ParseUUIDPipe) b: string) { return this.service.listBusiness(u.userId, b); }
  @Patch('business/:businessId/:orderId/status') status(@CurrentUser() u: AuthUser, @Param('businessId', ParseUUIDPipe) b: string, @Param('orderId', ParseUUIDPipe) o: string, @Body() d: StatusDto) { return this.service.transition(u.userId, b, o, d.status); }
}
