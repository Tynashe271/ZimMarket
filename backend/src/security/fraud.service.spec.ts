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

describe('FraudService.verificationFailure', () => {
  it('logs the first failed attempt at LOW severity', async () => {
    const create = jest.fn();
    const count = jest.fn().mockResolvedValue(0);
    const service = new FraudService({ fraudSignal: { count, create } } as never);

    await service.verificationFailure('user-a', 'PHONE');

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user-a', type: 'VERIFICATION_CODE_BRUTE_FORCE', severity: 'LOW', details: { verificationType: 'PHONE', attempts: 1 } }) });
  });

  it('escalates to HIGH severity once repeated failures cross the threshold', async () => {
    const create = jest.fn();
    const count = jest.fn().mockResolvedValue(4);
    const service = new FraudService({ fraudSignal: { count, create } } as never);

    await service.verificationFailure('user-a', 'PASSWORD_RESET');

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ severity: 'HIGH', details: { verificationType: 'PASSWORD_RESET', attempts: 5 } }) });
  });
});

describe('FraudService.rateLimitExceeded', () => {
  it('logs a LOW severity signal just over the limit', async () => {
    const create = jest.fn();
    const service = new FraudService({ fraudSignal: { create } } as never);

    await service.rateLimitExceeded('1.2.3.4', '/api/v1/auth/login', 'POST', 11, 10);

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'RATE_LIMIT_EXCEEDED', severity: 'LOW', details: { ip: '1.2.3.4', path: '/api/v1/auth/login', method: 'POST', totalHits: 11, limit: 10 } }) });
  });

  it('escalates to HIGH severity when hits are far past the limit', async () => {
    const create = jest.fn();
    const service = new FraudService({ fraudSignal: { create } } as never);

    await service.rateLimitExceeded('1.2.3.4', '/api/v1/auth/login', 'POST', 40, 10);

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ severity: 'HIGH' }) });
  });
});
