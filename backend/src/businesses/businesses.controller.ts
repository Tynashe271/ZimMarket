import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsObject, IsPhoneNumber, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { BusinessRole, FiscalisationMethod } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/current-user.decorator';
import { normalizePhone } from '../common/phone';
import { BusinessesService } from './businesses.service';
class CreateBusinessDto { @IsString() @MinLength(2) name!: string; @Matches(/^[a-z0-9-]+$/) slug!: string; }
class AddStaffDto { @Transform(({ value }) => normalizePhone(value)) @IsPhoneNumber('ZW') phone!: string; @IsEnum(BusinessRole) role!: BusinessRole; @IsArray() @IsUUID('4', { each: true }) branchIds!: string[]; }
class BusinessSettingsDto { @IsObject() settings!: Record<string, unknown>; }
class FiscalisationDto { @IsString() registeredBusinessName!:string; @IsString() tradingName!:string; @IsString() @MinLength(3) tin!:string; @IsString() vatNumber?:string; @IsString() taxClearanceCertificateNumber!:string; @IsDateString() taxClearanceIssuedAt!:string; @IsDateString() taxClearanceExpiresAt!:string; @IsString() taxClearanceDocumentKey!:string; @IsEnum(FiscalisationMethod) method!:FiscalisationMethod; @IsString() deviceIdentifier!:string; @IsString() deviceModel?:string; @IsString() deviceSerialNumber?:string; @IsString() virtualDeviceIdentifier?:string; @IsString() approvedSupplierOrIntegrator!:string; @IsString() zimraRegistrationEvidenceKey!:string; @IsObject() branchInformation!:Record<string,unknown>; @IsString() sampleFiscalReceiptKey!:string; @IsString() receiptVerificationCode!:string; @IsString() authorisedRepresentative!:string; }
@Controller('businesses') @UseGuards(JwtAuthGuard)
export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}
  @Get() list(@CurrentUser() user: AuthUser) { return this.service.list(user.userId); }
  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateBusinessDto) { return this.service.create(user.userId, user.accountType, dto.name, dto.slug); }
  @Post(':businessId/staff') addStaff(@CurrentUser() user: AuthUser, @Param('businessId', ParseUUIDPipe) businessId: string, @Body() dto: AddStaffDto) { return this.service.addStaff(user.userId, businessId, dto.phone, dto.role, dto.branchIds); }
  @Get(':businessId/settings') settings(@CurrentUser() user: AuthUser, @Param('businessId', ParseUUIDPipe) businessId: string) { return this.service.settings(user.userId, businessId); }
  @Patch(':businessId/settings') updateSettings(@CurrentUser() user: AuthUser, @Param('businessId', ParseUUIDPipe) businessId: string, @Body() dto: BusinessSettingsDto) { return this.service.updateSettings(user.userId, businessId, dto.settings as never); }
  @Post(':businessId/fiscalisation') fiscalisation(@CurrentUser() user: AuthUser, @Param('businessId', ParseUUIDPipe) businessId: string, @Body() dto: FiscalisationDto) { return this.service.submitFiscalisation(user.userId, businessId, { ...dto, taxClearanceIssuedAt:new Date(dto.taxClearanceIssuedAt), taxClearanceExpiresAt:new Date(dto.taxClearanceExpiresAt) }); }
  @Get(':businessId/notifications') notifications(@CurrentUser() user: AuthUser, @Param('businessId', ParseUUIDPipe) businessId: string) { return this.service.notifications(user.userId, businessId); }
  @Patch(':businessId/notifications/:notificationId/read') readNotification(@CurrentUser() user: AuthUser, @Param('businessId', ParseUUIDPipe) businessId: string, @Param('notificationId', ParseUUIDPipe) notificationId: string) { return this.service.readNotification(user.userId, businessId, notificationId); }
}
