import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ComplianceAuditService } from './compliance-audit.service';

@Injectable()
export class ComplianceReminderService {
  private readonly logger = new Logger(ComplianceReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ComplianceAuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkExpiryReminders() {
    this.logger.log('Checking compliance expiry reminders...');

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find businesses with compliance that need reminders
    const fiscalisations = await this.prisma.withSystemContext(tx => tx.businessFiscalisation.findMany({
      where: {
        status: {
          in: ['COMPLIANT', 'EXPIRING_SOON'],
        },
        taxClearanceExpiresAt: {
          lte: thirtyDays,
        },
      },
      include: {
        business: {
          include: {
            members: {
              where: {
                role: 'OWNER',
              },
              include: {
                user: true,
              },
            },
          },
        },
      },
    }));

    for (const fiscalisation of fiscalisations) {
      const expiryDate = fiscalisation.taxClearanceExpiresAt;
      const daysUntilExpiry = Math.floor(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilExpiry <= 30 && !fiscalisation.reminder30SentAt) {
        await this.sendReminder(fiscalisation, 'EXPIRY_30_DAYS', 30);
      }

      if (daysUntilExpiry <= 14 && !fiscalisation.reminder14SentAt) {
        await this.sendReminder(fiscalisation, 'EXPIRY_14_DAYS', 14);
      }

      if (daysUntilExpiry <= 7 && !fiscalisation.reminder7SentAt) {
        await this.sendReminder(fiscalisation, 'EXPIRY_7_DAYS', 7);
      }

      if (daysUntilExpiry <= 3 && !fiscalisation.reminder3SentAt) {
        await this.sendReminder(fiscalisation, 'EXPIRY_3_DAYS', 3);
      }

      if (daysUntilExpiry <= 1 && !fiscalisation.reminder1SentAt) {
        await this.sendReminder(fiscalisation, 'EXPIRY_1_DAY', 1);
      }

      if (daysUntilExpiry <= 0) {
        await this.sendReminder(fiscalisation, 'EXPIRY_TODAY', 0);
      }
    }

    this.logger.log(
      `Checked ${fiscalisations.length} businesses for compliance reminders`,
    );
  }

  private async sendReminder(
    fiscalisation: any,
    reminderType: string,
    daysUntilExpiry: number,
  ) {
    const owner = fiscalisation.business.members[0]?.user;
    if (!owner) return;

    const message = this.getReminderMessage(daysUntilExpiry);

    // Create reminder record
    await this.prisma.complianceReminder.create({
      data: {
        fiscalisationId: fiscalisation.id,
        reminderType,
        scheduledFor: new Date(),
        sentAt: new Date(),
        deliveryMethod: 'DASHBOARD',
        deliveryStatus: 'SENT',
        message,
        recipientEmail: owner.email,
        recipientPhone: owner.phone,
      },
    });

    // Update reminder sent timestamp
    const updateData: any = {};
    if (reminderType === 'EXPIRY_30_DAYS') {
      updateData.reminder30SentAt = new Date();
    } else if (reminderType === 'EXPIRY_14_DAYS') {
      updateData.reminder14SentAt = new Date();
    } else if (reminderType === 'EXPIRY_7_DAYS') {
      updateData.reminder7SentAt = new Date();
    } else if (reminderType === 'EXPIRY_3_DAYS') {
      updateData.reminder3SentAt = new Date();
    } else if (reminderType === 'EXPIRY_1_DAY') {
      updateData.reminder1SentAt = new Date();
    }

    await this.prisma.businessFiscalisation.update({
      where: { id: fiscalisation.id },
      data: updateData,
    });

    // Update status if expiring soon
    if (daysUntilExpiry <= 14 && daysUntilExpiry > 0) {
      await this.prisma.businessFiscalisation.update({
        where: { id: fiscalisation.id },
        data: { status: 'EXPIRING_SOON' },
      });

      await this.auditService.logAction(
        fiscalisation.id,
        'STATUS_CHANGED',
        'SYSTEM',
        'SYSTEM',
        'COMPLIANT',
        'EXPIRING_SOON',
        { reason: 'certificate_expiring_soon', daysUntilExpiry },
      );
    }

    // If expired, change status
    if (daysUntilExpiry <= 0) {
      await this.prisma.businessFiscalisation.update({
        where: { id: fiscalisation.id },
        data: { status: 'EXPIRED' },
      });

      await this.auditService.logAction(
        fiscalisation.id,
        'STATUS_CHANGED',
        'SYSTEM',
        'SYSTEM',
        'EXPIRING_SOON',
        'EXPIRED',
        { reason: 'certificate_expired' },
      );
    }

    this.logger.log(
      `Sent ${reminderType} reminder to business ${fiscalisation.businessId}`,
    );
  }

  private getReminderMessage(daysUntilExpiry: number): string {
    if (daysUntilExpiry <= 0) {
      return 'Your Tax Clearance Certificate has expired. Upload the renewed certificate immediately to prevent trading restrictions.';
    } else if (daysUntilExpiry === 1) {
      return 'Your Tax Clearance Certificate expires tomorrow. Upload the renewed certificate today to avoid service interruption.';
    } else if (daysUntilExpiry <= 3) {
      return `Your Tax Clearance Certificate expires in ${daysUntilExpiry} days. This is your final reminder before restrictions are applied.`;
    } else if (daysUntilExpiry <= 7) {
      return `Your Tax Clearance Certificate expires in ${daysUntilExpiry} days. Please renew through ZIMRA/TaRMS and upload the new certificate.`;
    } else if (daysUntilExpiry <= 14) {
      return `Your Tax Clearance Certificate expires in ${daysUntilExpiry} days. Start the renewal process through ZIMRA/TaRMS to ensure continuous service.`;
    } else {
      return `Your Tax Clearance Certificate expires in ${daysUntilExpiry} days. Plan ahead for renewal through ZIMRA/TaRMS.`;
    }
  }

  async sendManualReminder(fiscalisationId: string, reminderType: string) {
    const fiscalisation = await this.prisma.withSystemContext(tx => tx.businessFiscalisation.findUnique({
      where: { id: fiscalisationId },
      include: {
        business: {
          include: {
            members: {
              where: { role: 'OWNER' },
              include: { user: true },
            },
          },
        },
      },
    }));

    if (!fiscalisation) {
      throw new Error('Compliance record not found');
    }

    const owner = fiscalisation.business.members[0]?.user;
    if (!owner) {
      throw new Error('Business owner not found');
    }

    const message = this.getReminderMessageByType(reminderType);

    await this.prisma.complianceReminder.create({
      data: {
        fiscalisationId,
        reminderType,
        scheduledFor: new Date(),
        sentAt: new Date(),
        deliveryMethod: 'DASHBOARD',
        deliveryStatus: 'SENT',
        message,
        recipientEmail: owner.email,
        recipientPhone: owner.phone,
      },
    });

    return { success: true, message };
  }

  private getReminderMessageByType(reminderType: string): string {
    const messages: Record<string, string> = {
      EXPIRY_30_DAYS: 'Your Tax Clearance Certificate expires in 30 days. Plan ahead for renewal.',
      EXPIRY_14_DAYS: 'Your Tax Clearance Certificate expires in 14 days. Start the renewal process.',
      EXPIRY_7_DAYS: 'Your Tax Clearance Certificate expires in 7 days. Please renew soon.',
      EXPIRY_3_DAYS: 'Your Tax Clearance Certificate expires in 3 days. This is urgent.',
      EXPIRY_1_DAY: 'Your Tax Clearance Certificate expires tomorrow. Renew immediately.',
      EXPIRY_TODAY: 'Your Tax Clearance Certificate has expired. Renew now to restore service.',
    };

    return messages[reminderType] || 'Compliance action required.';
  }
}
