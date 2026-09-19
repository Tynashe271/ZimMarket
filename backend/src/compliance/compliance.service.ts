import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ComplianceStatus, BusinessRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { StoreRestrictionService } from './store-restriction.service';
import { ComplianceAuditService } from './compliance-audit.service';
import { ZimraIntegrationService } from './zimra-integration.service';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly restrictionService: StoreRestrictionService,
    private readonly auditService: ComplianceAuditService,
    private readonly zimraService: ZimraIntegrationService,
  ) {}

  async submitCompliance(userId: string, businessId: string, dto: any) {
    await this.ensureBusinessAccess(userId, businessId);

    const existing = await this.prisma.businessFiscalisation.findUnique({
      where: { businessId },
    });

    const taxClearanceIssuedAt = new Date(dto.taxClearanceIssuedAt);
    const taxClearanceExpiresAt = new Date(dto.taxClearanceExpiresAt);

    const fiscalisationData = {
      registeredBusinessName: dto.registeredBusinessName,
      tradingName: dto.tradingName,
      tin: dto.tin,
      vatNumber: dto.vatNumber || null,
      taxClearanceCertificateNumber: dto.taxClearanceCertificateNumber,
      taxClearanceIssuedAt,
      taxClearanceExpiresAt,
      taxClearanceDocumentKey: dto.taxClearanceDocumentKey,
      method: dto.method,
      deviceIdentifier: dto.deviceIdentifier,
      deviceModel: dto.deviceModel || null,
      deviceSerialNumber: dto.deviceSerialNumber || null,
      virtualDeviceIdentifier: dto.virtualDeviceIdentifier || null,
      approvedSupplierOrIntegrator: dto.approvedSupplierOrIntegrator,
      zimraRegistrationEvidenceKey: dto.zimraRegistrationEvidenceKey,
      branchInformation: dto.branchInformation,
      sampleFiscalReceiptKey: dto.sampleFiscalReceiptKey,
      receiptVerificationCode: dto.receiptVerificationCode,
      authorisedRepresentative: dto.authorisedRepresentative,
      status: ComplianceStatus.PENDING_VERIFICATION,
    };

    let result;
    if (existing) {
      result = await this.prisma.businessFiscalisation.update({
        where: { businessId },
        data: fiscalisationData,
      });
      await this.auditService.logAction(
        existing.id,
        'STATUS_CHANGED',
        userId,
        'BUSINESS_OWNER',
        existing.status,
        ComplianceStatus.PENDING_VERIFICATION,
        { action: 'compliance_updated' },
      );
    } else {
      result = await this.prisma.businessFiscalisation.create({
        data: {
          ...fiscalisationData,
          businessId,
        },
      });
      await this.auditService.logAction(
        result.id,
        'SUBMITTED',
        userId,
        'BUSINESS_OWNER',
        null,
        ComplianceStatus.PENDING_VERIFICATION,
        { action: 'compliance_submitted' },
      );
    }

    // Trigger automated verification if available
    await this.performAutomatedVerification(result.id);

    return result;
  }

  async getComplianceStatus(userId: string, businessId: string) {
    await this.ensureBusinessAccess(userId, businessId);

    const fiscalisation = await this.prisma.businessFiscalisation.findUnique({
      where: { businessId },
      include: {
        complianceDocuments: true,
        complianceChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 10,
        },
        storeRestrictions: {
          where: { isRestricted: true },
        },
      },
    });

    if (!fiscalisation) {
      return {
        hasSubmission: false,
        status: 'NONE',
        canTrade: false,
        restrictions: [],
        message: 'ZIMRA registration required',
      };
    }

    const canTrade = this.canBusinessTrade(fiscalisation);
    const restrictions = fiscalisation.storeRestrictions.map(r => r.restrictionType);

    return {
      hasSubmission: true,
      status: fiscalisation.status,
      canTrade,
      restrictions,
      fiscalisation: {
        ...fiscalisation,
        taxClearanceIssuedAt: fiscalisation.taxClearanceIssuedAt.toISOString(),
        taxClearanceExpiresAt: fiscalisation.taxClearanceExpiresAt.toISOString(),
      },
      documents: fiscalisation.complianceDocuments,
      recentChecks: fiscalisation.complianceChecks,
      message: this.getStatusMessage(fiscalisation.status, canTrade),
    };
  }

  async uploadDocument(userId: string, dto: any) {
    const fiscalisation = await this.prisma.businessFiscalisation.findUnique({
      where: { id: dto.fiscalisationId },
      include: { business: true },
    });

    if (!fiscalisation) {
      throw new NotFoundException('Compliance record not found');
    }

    await this.ensureBusinessAccess(userId, fiscalisation.businessId);

    const document = await this.prisma.complianceDocument.create({
      data: {
        fiscalisationId: dto.fiscalisationId,
        documentType: dto.documentType,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      },
    });

    await this.auditService.logAction(
      dto.fiscalisationId,
      'DOCUMENT_UPLOADED',
      userId,
      'BUSINESS_OWNER',
      null,
      null,
      { documentType: dto.documentType, fileName: dto.fileName },
    );

    return document;
  }

  async submitRenewal(userId: string, dto: any) {
    const fiscalisation = await this.prisma.businessFiscalisation.findUnique({
      where: { id: dto.fiscalisationId },
      include: { business: true },
    });

    if (!fiscalisation) {
      throw new NotFoundException('Compliance record not found');
    }

    await this.ensureBusinessAccess(userId, fiscalisation.businessId);

    const newExpiryDate = new Date(dto.newExpiryDate);

    // Upload new document
    await this.prisma.complianceDocument.create({
      data: {
        fiscalisationId: dto.fiscalisationId,
        documentType: dto.documentType,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: 'application/pdf', // Default, could be dynamic
        sizeBytes: 0, // Would be set from actual file
      },
    });

    // Update status to renewal pending
    const updated = await this.prisma.businessFiscalisation.update({
      where: { id: dto.fiscalisationId },
      data: {
        status: ComplianceStatus.UNDER_REVIEW,
        taxClearanceExpiresAt: newExpiryDate,
      },
    });

    await this.auditService.logAction(
      dto.fiscalisationId,
      'STATUS_CHANGED',
      userId,
      'BUSINESS_OWNER',
      fiscalisation.status,
      ComplianceStatus.UNDER_REVIEW,
      { action: 'renewal_submitted', newExpiryDate: newExpiryDate.toISOString() },
    );

    // Perform verification
    await this.performAutomatedVerification(dto.fiscalisationId);

    return updated;
  }

  async getStoreRestrictions(userId: string, fiscalisationId: string) {
    const fiscalisation = await this.prisma.businessFiscalisation.findUnique({
      where: { id: fiscalisationId },
      include: { business: true },
    });

    if (!fiscalisation) {
      throw new NotFoundException('Compliance record not found');
    }

    await this.ensureBusinessAccess(userId, fiscalisation.businessId);

    const restrictions = await this.prisma.storeRestriction.findMany({
      where: { fiscalisationId },
    });

    return {
      restrictions: restrictions.map(r => ({
        type: r.restrictionType,
        isRestricted: r.isRestricted,
        reason: r.reason,
        imposedAt: r.imposedAt.toISOString(),
        liftedAt: r.liftedAt?.toISOString(),
      })),
    };
  }

  async getAuditLog(userId: string, fiscalisationId: string) {
    const fiscalisation = await this.prisma.businessFiscalisation.findUnique({
      where: { id: fiscalisationId },
      include: { business: true },
    });

    if (!fiscalisation) {
      throw new NotFoundException('Compliance record not found');
    }

    await this.ensureBusinessAccess(userId, fiscalisation.businessId);

    const auditLogs = await this.prisma.complianceAuditLog.findMany({
      where: { fiscalisationId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return auditLogs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    }));
  }

  private async ensureBusinessAccess(userId: string, businessId: string) {
    const member = await this.prisma.businessMember.findUnique({
      where: { userId_businessId: { userId, businessId } },
    });

    if (!member) {
      throw new ForbiddenException('Business not found or access denied');
    }

    if (member.role !== BusinessRole.OWNER && member.role !== BusinessRole.MANAGER) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private canBusinessTrade(fiscalisation: any): boolean {
    const compliantStatuses = [
      ComplianceStatus.COMPLIANT,
      ComplianceStatus.EXPIRING_SOON,
    ];

    if (!compliantStatuses.includes(fiscalisation.status)) {
      return false;
    }

    // Check taxpayer and device status
    if (!fiscalisation.taxpayerActive || !fiscalisation.deviceActive) {
      return false;
    }

    // Check certificate expiry
    const now = new Date();
    if (fiscalisation.taxClearanceExpiresAt < now) {
      return false;
    }

    return true;
  }

  private getStatusMessage(status: ComplianceStatus, canTrade: boolean): string {
    switch (status) {
      case ComplianceStatus.DRAFT:
        return 'Application is incomplete. Complete all required fields and submit for verification.';
      case ComplianceStatus.PENDING_VERIFICATION:
        return 'Your compliance information is under review. This typically takes 1-3 business days.';
      case ComplianceStatus.CHANGES_REQUIRED:
        return 'Your application requires corrections. Please review the feedback and update your information.';
      case ComplianceStatus.COMPLIANT:
        return 'Your business is fully compliant and can operate normally on ZimMarket.';
      case ComplianceStatus.EXPIRING_SOON:
        return 'Your Tax Clearance Certificate is expiring soon. Upload the renewed certificate to prevent restrictions.';
      case ComplianceStatus.EXPIRED:
        return 'Your Tax Clearance Certificate has expired. New sales are restricted until you renew.';
      case ComplianceStatus.DEVICE_INACTIVE:
        return 'Your fiscal device is inactive. Contact your fiscal device provider to restore connectivity.';
      case ComplianceStatus.SUSPENDED:
        return 'Your business has been suspended due to compliance or policy issues. Contact support for details.';
      case ComplianceStatus.UNDER_REVIEW:
        return 'Your renewal or compliance change is under review.';
      default:
        return canTrade
          ? 'Your business is operational.'
          : 'Your business cannot accept new orders until compliance is restored.';
    }
  }

  private async performAutomatedVerification(fiscalisationId: string) {
    try {
      // Check if ZIMRA API integration is available
      const zimraEnabled = this.config.get('ZIMRA_API_ENABLED') === 'true';

      if (zimraEnabled) {
        // Perform taxpayer status check
        const taxpayerCheck = await this.zimraService.checkTaxpayerStatus(
          fiscalisationId,
        );

        // Perform device status check
        const deviceCheck = await this.zimraService.checkDeviceStatus(
          fiscalisationId,
        );

        // Perform receipt verification
        const receiptCheck = await this.zimraService.verifyReceipt(
          fiscalisationId,
        );

        // Update status based on checks
        await this.updateStatusFromChecks(
          fiscalisationId,
          taxpayerCheck,
          deviceCheck,
          receiptCheck,
        );
      } else {
        // Manual verification required
        await this.prisma.complianceCheck.create({
          data: {
            fiscalisationId,
            checkType: 'AUTOMATED_API',
            checkMethod: 'MANUAL_ADMIN',
            checkResult: 'PENDING',
            adminNotes: 'ZIMRA API integration not configured. Manual verification required.',
          },
        });
      }
    } catch (error) {
      console.error('Automated verification failed:', error);
      // Log the failure but don't block the process
      await this.prisma.complianceCheck.create({
        data: {
          fiscalisationId,
          checkType: 'AUTOMATED_API',
          checkMethod: 'MANUAL_ADMIN',
          checkResult: 'FAILED',
          adminNotes: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  private async updateStatusFromChecks(
    fiscalisationId: string,
    taxpayerCheck: any,
    deviceCheck: any,
    receiptCheck: any,
  ) {
    const allPassed =
      taxpayerCheck.result === 'PASSED' &&
      deviceCheck.result === 'PASSED' &&
      receiptCheck.result === 'PASSED';

    const fiscalisation = await this.prisma.businessFiscalisation.update({
      where: { id: fiscalisationId },
      data: {
        taxpayerActive: taxpayerCheck.result === 'PASSED',
        deviceActive: deviceCheck.result === 'PASSED',
        deviceRegistered: deviceCheck.result === 'PASSED',
        receiptVerifiedAt: receiptCheck.result === 'PASSED' ? new Date() : null,
        receiptVerificationReference:
          receiptCheck.result === 'PASSED' ? receiptCheck.reference : null,
        status: allPassed
          ? ComplianceStatus.COMPLIANT
          : ComplianceStatus.CHANGES_REQUIRED,
        reviewedAt: new Date(),
      },
    });

    // Apply or lift restrictions based on status
    if (allPassed) {
      await this.restrictionService.liftAllRestrictions(fiscalisationId);
    } else {
      await this.restrictionService.imposeTradingRestrictions(fiscalisationId);
    }

    return fiscalisation;
  }
}
