import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AvailabilityStatus } from '@prisma/client'; import { Type } from 'class-transformer'; import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Min, MinLength, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; import { AuthUser } from '../auth/jwt.strategy'; import { CurrentUser } from '../common/current-user.decorator'; import { OperationsService } from './operations.service';
class BranchDto { @IsString() @MinLength(2) name!: string; @IsString() province!: string; @IsString() city!: string; @IsOptional() @IsString() suburb?: string; @IsOptional() @IsArray() @IsString({ each: true }) deliveryAreas?: string[]; @IsOptional() @IsObject() operatingHours?: object; }
class InventoryDto { @IsInt() @Min(0) quantity!: number; @IsInt() @Min(0) lowStockAt!: number; @IsEnum(AvailabilityStatus) availability!: AvailabilityStatus; @IsBoolean() discloseQuantity!: boolean; }
class SaleLine { @IsUUID() productId!: string; @IsInt() @Min(1) quantity!: number; @IsNumber() @Min(0) unitPrice!: number; }
class SaleDto { @IsString() paymentMethod!: string; @IsString() @Length(3,3) currency!: string; @IsArray() @ValidateNested({ each: true }) @Type(() => SaleLine) lines!: SaleLine[]; }
@Controller() export class OperationsController {
  constructor(private readonly s: OperationsService) {}
  @Get('public/businesses') discover(@Query('city') city?: string, @Query('province') province?: string, @Query('tag') tag?: string) { return this.s.discover(city, province, tag); }
  @Get('public/businesses/:slug') @UseGuards(JwtAuthGuard) storefront(@CurrentUser() u: AuthUser, @Param('slug') slug: string) { return this.s.storefront(u.userId,u.accountType,slug); }
  @Post('businesses/:businessId/branches') @UseGuards(JwtAuthGuard) branch(@CurrentUser() u: AuthUser, @Param('businessId', ParseUUIDPipe) b: string, @Body() d: BranchDto) { return this.s.createBranch(u.userId,b,d); }
  @Put('businesses/:businessId/branches/:branchId/inventory/:productId') @UseGuards(JwtAuthGuard) inventory(@CurrentUser() u: AuthUser, @Param('businessId', ParseUUIDPipe) b: string, @Param('branchId', ParseUUIDPipe) br: string, @Param('productId', ParseUUIDPipe) p: string, @Body() d: InventoryDto) { return this.s.setInventory(u.userId,b,br,p,d); }
  @Post('businesses/:businessId/branches/:branchId/pos/sales') @UseGuards(JwtAuthGuard) sale(@CurrentUser() u: AuthUser, @Param('businessId', ParseUUIDPipe) b: string, @Param('branchId', ParseUUIDPipe) br: string, @Body() d: SaleDto) { return this.s.recordSale(u.userId,b,br,d.paymentMethod,d.currency.toUpperCase(),d.lines); }
  @Get('businesses/:businessId/branches/:branchId/summary') @UseGuards(JwtAuthGuard) summary(@CurrentUser() u: AuthUser, @Param('businessId', ParseUUIDPipe) b: string, @Param('branchId', ParseUUIDPipe) br: string) { return this.s.branchSummary(u.userId,b,br); }
}
