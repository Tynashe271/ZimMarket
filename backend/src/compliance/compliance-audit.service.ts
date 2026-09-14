import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ComplianceAuditService {
  private readonly logger = new Logger(ComplianceAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(
    fiscalisationId: string,
    action: string,
    actorId: string,
    actorType: string,
    previousStatus: string | null,
    newStatus: string | null,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      await this.prisma.complianceAuditLog.create({
        data: {
          fiscalisationId,
          action,
          actorId,
          actorType,
          previousStatus,
          newStatus,
          details: (details || {}) as any,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      this.logger.log(
        `Audit log: ${action} by ${actorType} on fiscalisation ${fiscalisationId}`,
      );
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
    }
  }

  async getAuditLogs(fiscalisationId: string, limit = 50) {
    return this.prisma.complianceAuditLog.findMany({
      where: { fiscalisationId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async getAuditLogsByActor(actorId: string, limit = 50) {
    return this.prisma.complianceAuditLog.findMany({
      where: { actorId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async getAuditLogsByAction(action: string, limit = 50) {
    return this.prisma.complianceAuditLog.findMany({
      where: { action },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async getRecentActivity(limit = 100) {
    return this.prisma.complianceAuditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        fiscalisation: {
          include: {
            business: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  }

  async getComplianceTimeline(fiscalisationId: string) {
    const logs = await this.prisma.complianceAuditLog.findMany({
      where: { fiscalisationId },
      orderBy: { timestamp: 'asc' },
    });

    return logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    }));
  }
}
