import { NotificationProcessor } from './notification.processor';

function makeJob(name: string, data: Record<string, unknown> = {}) {
  return { name, data } as never;
}

describe('NotificationProcessor compliance expiry scan', () => {
  it('suspends the business and its active products once the tax clearance certificate has expired', async () => {
    const fiscalisation = {
      id: 'fiscalisation-a',
      businessId: 'business-a',
      status: 'COMPLIANT',
      taxClearanceExpiresAt: new Date(Date.now() - 86_400_000),
      business: { id: 'business-a', name: 'Harare Traders', members: [{ user: { email: 'owner@zim.co.zw', phone: null } }] },
    };
    const transaction = jest.fn();
    const createMany = jest.fn();
    const prisma = {
      businessFiscalisation: { findMany: jest.fn().mockResolvedValue([fiscalisation]), update: jest.fn() },
      business: { update: jest.fn() },
      product: { updateMany: jest.fn() },
      notificationOutbox: { createMany },
      $transaction: transaction,
    };
    const processor = new NotificationProcessor(prisma as never, {} as never);

    const result = await processor.process(makeJob('compliance-expiry-scan'));

    expect(transaction).toHaveBeenCalled();
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ template: 'TAX_CLEARANCE_EXPIRED', recipient: 'owner@zim.co.zw' })]),
    }));
    expect(result).toEqual({ checked: 1, reminded: 1, suspended: 1 });
  });

  it('sends a 7-day reminder without suspending a business that is still within its grace window', async () => {
    const fiscalisation = {
      id: 'fiscalisation-a',
      businessId: 'business-a',
      status: 'EXPIRING_SOON',
      reminder7SentAt: null,
      taxClearanceExpiresAt: new Date(Date.now() + 6 * 86_400_000),
      business: { id: 'business-a', name: 'Harare Traders', members: [{ user: { email: 'owner@zim.co.zw', phone: null } }] },
    };
    const update = jest.fn();
    const businessUpdate = jest.fn();
    const createMany = jest.fn();
    const prisma = {
      businessFiscalisation: { findMany: jest.fn().mockResolvedValue([fiscalisation]), update },
      business: { update: businessUpdate },
      product: { updateMany: jest.fn() },
      notificationOutbox: { createMany },
      $transaction: jest.fn(),
    };
    const processor = new NotificationProcessor(prisma as never, {} as never);

    const result = await processor.process(makeJob('compliance-expiry-scan'));

    expect(businessUpdate).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ where: { id: 'fiscalisation-a' }, data: { reminder7SentAt: expect.any(Date) } });
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ template: 'TAX_CLEARANCE_EXPIRES_7_DAYS' })]),
    }));
    expect(result).toEqual({ checked: 1, reminded: 1, suspended: 0 });
  });

  it('dispatches a plain notification job through the configured provider', async () => {
    const send = jest.fn().mockResolvedValue({ accepted: true });
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ email: 'customer@zim.co.zw', phone: null }) } };
    const processor = new NotificationProcessor(prisma as never, { send } as never);

    const result = await processor.process(makeJob('order.confirmed', { userId: 'user-a', type: 'EMAIL' }));

    expect(send).toHaveBeenCalledWith('EMAIL', 'customer@zim.co.zw', 'order.confirmed', { userId: 'user-a', type: 'EMAIL' });
    expect(result).toEqual({ accepted: true });
  });

  it('skips dispatch when the recipient has no address for the requested channel', async () => {
    const send = jest.fn();
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ email: null, phone: null }) } };
    const processor = new NotificationProcessor(prisma as never, { send } as never);

    const result = await processor.process(makeJob('order.confirmed', { userId: 'user-a', type: 'EMAIL' }));

    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: true });
  });
});
