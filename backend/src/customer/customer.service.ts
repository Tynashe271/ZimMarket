import { ForbiddenException, Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async workspace(userId: string, accountType: string) {
    if (accountType !== AccountType.CUSTOMER) throw new ForbiddenException('Customer account required');
    // Several of these queries join into User (via messages' senderId... no --
    // via the conversation's own customer implicitly) or Order (refundRequest),
    // both RLS-protected, so the whole read runs inside one session context.
    return this.prisma.withContext({ userId, accountType }, async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } });
      const recipients = [user?.email, user?.phone].filter((value): value is string => Boolean(value));
      const [bookings, conversations, follows, reservations, tickets, reports, refunds, activity, notifications] = await Promise.all([
        tx.booking.findMany({ where: { customerId: userId }, include: { service: { include: { business: { select: { name: true, slug: true } } } }, branch: { select: { name: true, city: true } } }, orderBy: { createdAt: 'desc' } }),
        tx.conversation.findMany({ where: { customerId: userId }, include: { business: { select: { name: true, slug: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' } }),
        tx.productFollow.findMany({ where: { customerId: userId }, include: { product: { include: { business: { select: { name: true, slug: true } } } } } }),
        tx.reservation.findMany({ where: { customerId: userId }, include: { product: { select: { name: true } }, branch: { select: { name: true, city: true } } }, orderBy: { expiresAt: 'desc' } }),
        tx.supportTicket.findMany({ where: { userId }, include: { business: { select: { name: true } } }, orderBy: { updatedAt: 'desc' } }),
        tx.report.findMany({ where: { reporterId: userId }, include: { business: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
        tx.refundRequest.findMany({ where: { requesterId: userId }, include: { order: { select: { id: true, total: true, currency: true } }, business: { select: { name: true } } }, orderBy: { updatedAt: 'desc' } }),
        tx.auditLog.findMany({ where: { actorId: userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, action: true, resource: true, resourceId: true, createdAt: true, ipAddress: true } }),
        recipients.length ? tx.notificationOutbox.findMany({ where: { recipient: { in: recipients } }, orderBy: { createdAt: 'desc' }, take: 50 }) : Promise.resolve([]),
      ]);
      return { bookings, conversations, follows, reservations, tickets, reports, refunds, activity, notifications };
    });
  }
}
