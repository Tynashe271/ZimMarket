import { BadRequestException, Injectable } from '@nestjs/common'; import { PrismaService } from '../prisma/prisma.service';
@Injectable() export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}
  async export(userId: string) {
    const user = await this.prisma.withContext({ userId }, tx => tx.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, phone: true, accountType: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true, memberships: { include: { business: true } }, orders: { include: { items: true, payments: true } }, messages: true, reportsFiled: true } }));
    return { exportedAt: new Date().toISOString(), user };
  }
  async remove(userId: string) {
    const openOrders = await this.prisma.withContext({ userId }, tx => tx.order.count({ where: { customerId: userId, status: { in: ['PENDING','CONFIRMED','PAID','PROCESSING','SHIPPED'] } } }));
    if (openOrders) throw new BadRequestException('Complete or cancel active orders before deleting the account');
    await this.prisma.withContext({ userId }, async tx => {
      await tx.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
      await tx.user.update({ where: { id: userId }, data: { email: null, phone: `deleted-${userId}`, passwordHash: 'deleted', deletedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'account.delete', resource: 'User', resourceId: userId } });
    });
    return { deleted: true };
  }
}
