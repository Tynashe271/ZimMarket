import { ForbiddenException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { CustomerService } from './customer.service';

function emptyPrisma(overrides: Record<string, unknown> = {}) {
  const empty = { findMany: jest.fn().mockResolvedValue([]) };
  return {
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'customer@zim.co.zw', phone: null }) },
    booking: empty,
    conversation: empty,
    productFollow: empty,
    reservation: empty,
    supportTicket: empty,
    report: empty,
    refundRequest: empty,
    auditLog: empty,
    notificationOutbox: empty,
    ...overrides,
  };
}

describe('CustomerService workspace', () => {
  it('rejects a non-customer account before querying the database', async () => {
    const findUnique = jest.fn();
    const service = new CustomerService({ user: { findUnique } } as never);
    await expect(service.workspace('user-a', AccountType.BUSINESS)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('assembles the customer workspace from every related record type', async () => {
    const service = new CustomerService(emptyPrisma() as never);
    const workspace = await service.workspace('user-a', AccountType.CUSTOMER);
    expect(workspace).toEqual({ bookings: [], conversations: [], follows: [], reservations: [], tickets: [], reports: [], refunds: [], activity: [], notifications: [] });
  });

  it('skips the notification lookup when the customer has no known contact address', async () => {
    const findMany = jest.fn();
    const prisma = emptyPrisma({ user: { findUnique: jest.fn().mockResolvedValue({ email: null, phone: null }) }, notificationOutbox: { findMany } });
    const service = new CustomerService(prisma as never);

    await service.workspace('user-a', AccountType.CUSTOMER);

    expect(findMany).not.toHaveBeenCalled();
  });
});
