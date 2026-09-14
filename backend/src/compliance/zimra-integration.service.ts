import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZimraIntegrationService {
  private readonly logger = new Logger(ZimraIntegrationService.name);
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiBaseUrl = this.config.get('ZIMRA_API_URL') || 'https://api.zimra.co.zw';
    this.apiKey = this.config.get('ZIMRA_API_KEY') || '';
  }

  async checkTaxpayerStatus(fiscalisationId: string) {
    const fiscalisation = await this.prisma.businessFiscalisation.findUnique({
      where: { id: fiscalisationId },
    });

    if (!fiscalisation) {
      throw new Error('Compliance record not found');
    }

    try {
      // Log the check
      await this.prisma.complianceCheck.create({
        data: {
          fiscalisationId,
          checkType: 'TAXPAYER_STATUS',
          checkMethod: 'AUTOMATED_API',
          checkResult: 'PENDING',
        },
      });

      if (!this.apiKey) {
        // Fallback to manual verification
        return {
          result: 'INCONCLUSIVE',
          message: 'ZIMRA API not configured. Manual verification required.',
        };
      }

      // Call ZIMRA API (placeholder - actual implementation depends on ZIMRA API spec)
      const response = await this.callZimraApi(
        '/taxpayer/status',
        { tin: fiscalisation.tin },
      );

      const isActive = response.active === true;
      const checkResult = isActive ? 'PASSED' : 'FAILED';

      // Update check record
      await this.prisma.complianceCheck.updateMany({
        where: {
          fiscalisationId,
          checkType: 'TAXPAYER_STATUS',
          checkResult: 'PENDING',
        },
        data: {
          checkResult,
          apiResponse: response,
          checkedAt: new Date(),
        },
      });

      return {
        result: checkResult,
        message: isActive
          ? 'Taxpayer is active'
          : 'Taxpayer is inactive or not found',
        data: response,
      };
    } catch (error) {
      this.logger.error('Taxpayer status check failed:', error);

      await this.prisma.complianceCheck.create({
        data: {
          fiscalisationId,
          checkType: 'TAXPAYER_STATUS',
          checkMethod: 'AUTOMATED_API',
          checkResult: 'FAILED',
          adminNotes: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      return {
        result: 'FAILED',
        message: 'Taxpayer status check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkDeviceStatus(fiscalisationId: string) {
    const fiscalisation = await this.prisma.businessFiscalisation.findUnique({
      where: { id: fiscalisationId },
    });

    if (!fiscalisation) {
      throw new Error('Compliance record not found');
    }

    try {
      await this.prisma.complianceCheck.create({
        data: {
          fiscalisationId,
          checkType: 'DEVICE_STATUS',
          checkMethod: 'AUTOMATED_API',
          checkResult: 'PENDING',
        },
      });

      if (!this.apiKey) {
        return {
          result: 'INCONCLUSIVE',
          message: 'ZIMRA API not configured. Manual verification required.',
        };
      }

      // Call ZIMRA FDMS API for device status
      const response = await this.callZimraApi('/fdms/device/status', {
        deviceIdentifier: fiscalisation.deviceIdentifier,
        method: fiscalisation.method,
      });

      const isActive = response.active === true;
      const isRegistered = response.registered === true;
      const checkResult = isActive && isRegistered ? 'PASSED' : 'FAILED';

      await this.prisma.complianceCheck.updateMany({
        where: {
          fiscalisationId,
          checkType: 'DEVICE_STATUS',
          checkResult: 'PENDING',
        },
        data: {
          checkResult,
          apiResponse: response,
          checkedAt: new Date(),
        },
      });

      return {
        result: checkResult,
        message: isActive
          ? 'Device is active and registered'
          : 'Device is inactive or not registered',
        data: response,
      };
    } catch (error) {
      this.logger.error('Device status check failed:', error);

      await this.prisma.complianceCheck.create({
        data: {
          fiscalisationId,
          checkType: 'DEVICE_STATUS',
          checkMethod: 'AUTOMATED_API',
          checkResult: 'FAILED',
          adminNotes: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      return {
        result: 'FAILED',
        message: 'Device status check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async verifyReceipt(fiscalisationId: string) {
    const fiscalisation = await this.prisma.businessFiscalisation.findUnique({
      where: { id: fiscalisationId },
    });

    if (!fiscalisation) {
      throw new Error('Compliance record not found');
    }

    try {
      await this.prisma.complianceCheck.create({
        data: {
          fiscalisationId,
          checkType: 'RECEIPT_VERIFICATION',
          checkMethod: 'RECEIPT_VALIDATION',
          checkResult: 'PENDING',
        },
      });

      if (!this.apiKey) {
        return {
          result: 'INCONCLUSIVE',
          message: 'ZIMRA API not configured. Manual verification required.',
        };
      }

      // Call ZIMRA FDMS receipt verification API
      const response = await this.callZimraApi('/fdms/receipt/verify', {
        verificationCode: fiscalisation.receiptVerificationCode,
        deviceIdentifier: fiscalisation.deviceIdentifier,
      });

      const isValid = response.valid === true;
      const checkResult = isValid ? 'PASSED' : 'FAILED';

      await this.prisma.complianceCheck.updateMany({
        where: {
          fiscalisationId,
          checkType: 'RECEIPT_VERIFICATION',
          checkResult: 'PENDING',
        },
        data: {
          checkResult,
          apiResponse: response,
          checkedAt: new Date(),
        },
      });

      return {
        result: checkResult,
        message: isValid
          ? 'Receipt is valid and registered with FDMS'
          : 'Receipt is invalid or not found in FDMS',
        reference: response.reference,
        data: response,
      };
    } catch (error) {
      this.logger.error('Receipt verification failed:', error);

      await this.prisma.complianceCheck.create({
        data: {
          fiscalisationId,
          checkType: 'RECEIPT_VERIFICATION',
          checkMethod: 'RECEIPT_VALIDATION',
          checkResult: 'FAILED',
          adminNotes: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      return {
        result: 'FAILED',
        message: 'Receipt verification failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async verifyTaxClearanceCertificate(fiscalisationId: string) {
    const fiscalisation = await this.prisma.businessFiscalisation.findUnique({
      where: { id: fiscalisationId },
    });

    if (!fiscalisation) {
      throw new Error('Compliance record not found');
    }

    try {
      await this.prisma.complianceCheck.create({
        data: {
          fiscalisationId,
          checkType: 'CERTIFICATE_VALIDITY',
          checkMethod: 'AUTOMATED_API',
          checkResult: 'PENDING',
        },
      });

      if (!this.apiKey) {
        return {
          result: 'INCONCLUSIVE',
          message: 'ZIMRA API not configured. Manual verification required.',
        };
      }

      // Call ZIMRA API to verify tax clearance certificate
      const response = await this.callZimraApi('/tax/clearance/verify', {
        certificateNumber: fiscalisation.taxClearanceCertificateNumber,
        tin: fiscalisation.tin,
      });

      const isValid = response.valid === true;
      const checkResult = isValid ? 'PASSED' : 'FAILED';

      await this.prisma.complianceCheck.updateMany({
        where: {
          fiscalisationId,
          checkType: 'CERTIFICATE_VALIDITY',
          checkResult: 'PENDING',
        },
        data: {
          checkResult,
          apiResponse: response,
          checkedAt: new Date(),
        },
      });

      return {
        result: checkResult,
        message: isValid
          ? 'Tax Clearance Certificate is valid'
          : 'Tax Clearance Certificate is invalid or expired',
        data: response,
      };
    } catch (error) {
      this.logger.error('Tax clearance verification failed:', error);

      await this.prisma.complianceCheck.create({
        data: {
          fiscalisationId,
          checkType: 'CERTIFICATE_VALIDITY',
          checkMethod: 'AUTOMATED_API',
          checkResult: 'FAILED',
          adminNotes: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      return {
        result: 'FAILED',
        message: 'Tax clearance verification failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async callZimraApi(endpoint: string, data: Record<string, unknown>) {
    // Placeholder implementation - actual implementation depends on ZIMRA API specification
    // This would typically use an HTTP client like Axios or the native fetch API

    this.logger.log(`Calling ZIMRA API: ${endpoint}`, data);

    // Simulated response for development
    return {
      active: true,
      registered: true,
      valid: true,
      reference: 'ZIMRA-' + Date.now(),
      timestamp: new Date().toISOString(),
    };
  }

  async performFullVerification(fiscalisationId: string) {
    const results = await Promise.all([
      this.checkTaxpayerStatus(fiscalisationId),
      this.checkDeviceStatus(fiscalisationId),
      this.verifyReceipt(fiscalisationId),
      this.verifyTaxClearanceCertificate(fiscalisationId),
    ]);

    return {
      taxpayer: results[0],
      device: results[1],
      receipt: results[2],
      certificate: results[3],
      overall: results.every(r => r.result === 'PASSED') ? 'PASSED' : 'FAILED',
    };
  }
}
