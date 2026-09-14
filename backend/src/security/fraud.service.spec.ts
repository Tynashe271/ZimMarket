import { Prisma } from '@prisma/client';
import { FraudService } from './fraud.service';

describe('FraudService order evaluation', () => {
  it('does not signal a normal, low-value order', async () => {
    const create = jest.fn();
    const count = jest.fn().mockResolvedValue(1);
    const service = new FraudService({ order: { count }, fraudSignal: { create } } as never);

    await service.evaluateOrder('user-a', 'business-a', new Prisma.Decimal(50));

    expect(create).not.toHaveBeenCalled();
  });

  it('flags a HIGH severity signal once the order total crosses the threshold', async () => {
    const create = jest.fn();
    const count = jest.fn().mockResolvedValue(1);
    const service = new FraudService({ order: { count }, fraudSignal: { create } } as never);

    await service.evaluateOrder('user-a', 'business-a', new Prisma.Decimal(5000));

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user-a', businessId: 'business-a', type: 'UNUSUAL_ORDERING', severity: 'HIGH' }) });
  });

  it('flags a MEDIUM severity signal once daily order volume crosses the threshold', async () => {
    const create = jest.fn();
    const count = jest.fn().mockResolvedValue(10);
    const service = new FraudService({ order: { count }, fraudSignal: { create } } as never);

    await service.evaluateOrder('user-a', 'business-a', new Prisma.Decimal(20));

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ severity: 'MEDIUM', details: { dailyOrderCount: 10, total: '20' } }) });
  });

  it('lists open fraud signals ordered by severity then recency', () => {
    const findMany = jest.fn();
    const service = new FraudService({ fraudSignal: { findMany } } as never);

    service.open();

    expect(findMany).toHaveBeenCalledWith({ where: { resolvedAt: null }, orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }] });
  });
});
