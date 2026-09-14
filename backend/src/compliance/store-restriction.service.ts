import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ComplianceAuditService } from './compliance-audit.service';

@Injectable()
export class StoreRestrictionService {
  private readonly logger = new Logger(StoreRestrictionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ComplianceAuditService,
  ) {}

  async imposeTradingRestrictions(fiscalisationId: string, reason?: string) {
    const restrictionTypes = [
      'NEW_PRODUCTS',
      'NEW_SERVICES',
      'NEW_ADS',
      'NEW_ORDERS',
      'NEW_BOOKINGS',
      'PAYMENTS',
      'PAYOUTS',
    ];

    const restrictions = [];

    for (const restrictionType of restrictionTypes) {
      const existing = await this.prisma.storeRestriction.findFirst({
        where: {
          fiscalisationId,
          restrictionType,
          isRestricted: true,
        },
      });

      if (!existing) {
        const restriction = await this.prisma.storeRestriction.create({
          data: {
            fiscalisationId,
            restrictionType,
            isRestricted: true,
            reason: reason || 'Compliance requirements not met',
          },
        });
        restrictions.push(restriction);
      }
    }

    await this.auditService.logAction(
      fiscalisationId,
      'RESTRICTION_IMPOSED',
      'SYSTEM',
      'SYSTEM',
      null,
      null,
      { restrictions: restrictionTypes, reason },
    );

    this.logger.log(
      `Imposed trading restrictions on fiscalisation ${fiscalisationId}`,
    );

    return restrictions;
  }

  async liftAllRestrictions(fiscalisationId: string, liftedById?: string) {
    const restrictions = await this.prisma.storeRestriction.findMany({
      where: {
        fiscalisationId,
        isRestricted: true,
      },
    });

    for (const restriction of restrictions) {
      await this.prisma.storeRestriction.update({
        where: { id: restriction.id },
        data: {
          isRestricted: false,
          liftedAt: new Date(),
          liftedById,
        },
      });
    }

    await this.auditService.logAction(
      fiscalisationId,
      'RESTRICTION_LIFTED',
      liftedById || 'SYSTEM',
      liftedById ? 'ADMIN' : 'SYSTEM',
      null,
      null,
      { count: restrictions.length },
    );

    this.logger.log(
      `Lifted all restrictions on fiscalisation ${fiscalisationId}`,
    );

    return restrictions;
  }

  async imposeSpecificRestriction(
    fiscalisationId: string,
    restrictionType: string,
    reason: string,
    imposedById?: string,
  ) {
    const existing = await this.prisma.storeRestriction.findFirst({
      where: {
        fiscalisationId,
        restrictionType,
        isRestricted: true,
      },
    });

    if (existing) {
      return existing;
    }

    const restriction = await this.prisma.storeRestriction.create({
      data: {
        fiscalisationId,
        restrictionType,
        isRestricted: true,
        reason,
        imposedById,
      },
    });

    await this.auditService.logAction(
      fiscalisationId,
      'RESTRICTION_IMPOSED',
      imposedById || 'SYSTEM',
      imposedById ? 'ADMIN' : 'SYSTEM',
      null,
      null,
      { restrictionType, reason },
    );

    return restriction;
  }

  async liftSpecificRestriction(
    fiscalisationId: string,
    restrictionType: string,
    liftedById?: string,
  ) {
    const restriction = await this.prisma.storeRestriction.findFirst({
      where: {
        fiscalisationId,
        restrictionType,
        isRestricted: true,
      },
    });

    if (!restriction) {
      return null;
    }

    const updated = await this.prisma.storeRestriction.update({
      where: { id: restriction.id },
      data: {
        isRestricted: false,
        liftedAt: new Date(),
        liftedById,
      },
    });

    await this.auditService.logAction(
      fiscalisationId,
      'RESTRICTION_LIFTED',
      liftedById || 'SYSTEM',
      liftedById ? 'ADMIN' : 'SYSTEM',
      null,
      null,
      { restrictionType },
    );

    return updated;
  }

  async isRestricted(fiscalisationId: string, restrictionType: string) {
    const restriction = await this.prisma.storeRestriction.findFirst({
      where: {
        fiscalisationId,
        restrictionType,
        isRestricted: true,
      },
    });

    return !!restriction;
  }

  async getActiveRestrictions(fiscalisationId: string) {
    const restrictions = await this.prisma.storeRestriction.findMany({
      where: {
        fiscalisationId,
        isRestricted: true,
      },
    });

    return restrictions.map(r => r.restrictionType);
  }

  async canPublishProducts(fiscalisationId: string) {
    return !(await this.isRestricted(fiscalisationId, 'NEW_PRODUCTS'));
  }

  async canPublishServices(fiscalisationId: string) {
    return !(await this.isRestricted(fiscalisationId, 'NEW_SERVICES'));
  }

  async canPublishAds(fiscalisationId: string) {
    return !(await this.isRestricted(fiscalisationId, 'NEW_ADS'));
  }

  async canAcceptOrders(fiscalisationId: string) {
    return !(await this.isRestricted(fiscalisationId, 'NEW_ORDERS'));
  }

  async canAcceptBookings(fiscalisationId: string) {
    return !(await this.isRestricted(fiscalisationId, 'NEW_BOOKINGS'));
  }

  async canProcessPayments(fiscalisationId: string) {
    return !(await this.isRestricted(fiscalisationId, 'PAYMENTS'));
  }

  async canRequestPayouts(fiscalisationId: string) {
    return !(await this.isRestricted(fiscalisationId, 'PAYOUTS'));
  }
}
