import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/current-user.decorator';
import { ComplianceService } from './compliance.service';
import { FiscalisationMethod } from '@prisma/client';

class ComplianceSubmissionDto {
  @IsString()
  @MinLength(2)
  registeredBusinessName!: string;

  @IsString()
  @MinLength(2)
  tradingName!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(15)
  tin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  vatNumber?: string;

  @IsString()
  @MinLength(5)
  taxClearanceCertificateNumber!: string;

  @IsString()
  taxClearanceIssuedAt!: string; // ISO date string

  @IsString()
  taxClearanceExpiresAt!: string; // ISO date string

  @IsString()
  taxClearanceDocumentKey!: string;

  @IsEnum(FiscalisationMethod)
  method!: FiscalisationMethod;

  @IsString()
  @MinLength(2)
  deviceIdentifier!: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  deviceSerialNumber?: string;

  @IsOptional()
  @IsString()
  virtualDeviceIdentifier?: string;

  @IsString()
  @MinLength(2)
  approvedSupplierOrIntegrator!: string;

  @IsString()
  zimraRegistrationEvidenceKey!: string;

  branchInformation!: Record<string, unknown>;

  @IsString()
  sampleFiscalReceiptKey!: string;

  @IsString()
  @MinLength(4)
  receiptVerificationCode!: string;

  @IsString()
  @MinLength(2)
  authorisedRepresentative!: string;
}

class DocumentUploadDto {
  @IsUUID()
  fiscalisationId!: string;

  @IsString()
  documentType!: string; // TAX_CLEARANCE, ZIMRA_REGISTRATION, FISCAL_DEVICE, VAT_REGISTRATION, SECTOR_LICENCE

  @IsString()
  storageKey!: string;

  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  sizeBytes!: number;
}

class RenewalSubmissionDto {
  @IsUUID()
  fiscalisationId!: string;

  @IsString()
  documentType!: string;

  @IsString()
  storageKey!: string;

  @IsString()
  fileName!: string;

  @IsString()
  newExpiryDate!: string; // ISO date string
}

@Controller('businesses')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post(':businessId/compliance')
  @UseGuards(JwtAuthGuard)
  submitCompliance(
    @CurrentUser() user: AuthUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: ComplianceSubmissionDto,
  ) {
    return this.complianceService.submitCompliance(user.userId, businessId, dto);
  }

  @Get(':businessId/compliance')
  @UseGuards(JwtAuthGuard)
  getComplianceStatus(
    @CurrentUser() user: AuthUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.complianceService.getComplianceStatus(user.userId, businessId);
  }

  @Post('compliance/documents')
  @UseGuards(JwtAuthGuard)
  uploadComplianceDocument(
    @CurrentUser() user: AuthUser,
    @Body() dto: DocumentUploadDto,
  ) {
    return this.complianceService.uploadDocument(user.userId, dto);
  }

  @Post('compliance/renewal')
  @UseGuards(JwtAuthGuard)
  submitRenewal(
    @CurrentUser() user: AuthUser,
    @Body() dto: RenewalSubmissionDto,
  ) {
    return this.complianceService.submitRenewal(user.userId, dto);
  }

  @Get('compliance/:fiscalisationId/restrictions')
  @UseGuards(JwtAuthGuard)
  getStoreRestrictions(
    @CurrentUser() user: AuthUser,
    @Param('fiscalisationId', ParseUUIDPipe) fiscalisationId: string,
  ) {
    return this.complianceService.getStoreRestrictions(user.userId, fiscalisationId);
  }

  @Get('compliance/:fiscalisationId/audit-log')
  @UseGuards(JwtAuthGuard)
  getAuditLog(
    @CurrentUser() user: AuthUser,
    @Param('fiscalisationId', ParseUUIDPipe) fiscalisationId: string,
  ) {
    return this.complianceService.getAuditLog(user.userId, fiscalisationId);
  }
}
