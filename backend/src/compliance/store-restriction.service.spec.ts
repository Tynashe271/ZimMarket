import { StoreRestrictionService } from './store-restriction.service';

describe('StoreRestrictionService', () => {
  it('imposes every restriction type once and audits the action', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `${data.restrictionType}-id`, ...data }));
    const logAction = jest.fn();
    const prisma = { storeRestriction: { findFirst, create } } as never;
    const service = new StoreRestrictionService(prisma, { logAction } as never);

    const restrictions = await service.imposeTradingRestrictions('fiscalisation-a', 'Tax clearance expired');

    expect(restrictions).toHaveLength(7);
    expect(create).toHaveBeenCalledTimes(7);
    expect(create.mock.calls[0][0].data).toMatchObject({ fiscalisationId: 'fiscalisation-a', isRestricted: true, reason: 'Tax clearance expired' });
    expect(logAction).toHaveBeenCalledWith('fiscalisation-a', 'RESTRICTION_IMPOSED', 'SYSTEM', 'SYSTEM', null, null, expect.objectContaining({ reason: 'Tax clearance expired' }));
  });

  it('does not duplicate a restriction that is already active', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'existing' });
    const create = jest.fn();
    const prisma = { storeRestriction: { findFirst, create } } as never;
    const service = new StoreRestrictionService(prisma, { logAction: jest.fn() } as never);

    const restrictions = await service.imposeTradingRestrictions('fiscalisation-a');

    expect(restrictions).toHaveLength(0);
    expect(create).not.toHaveBeenCalled();
  });

  it('lifts every active restriction and audits the count', async () => {
    const active = [{ id: 'r1', restrictionType: 'NEW_PRODUCTS' }, { id: 'r2', restrictionType: 'PAYMENTS' }];
    const findMany = jest.fn().mockResolvedValue(active);
    const update = jest.fn().mockResolvedValue({});
    const logAction = jest.fn();
    const prisma = { storeRestriction: { findMany, update } } as never;
    const service = new StoreRestrictionService(prisma, { logAction } as never);

    await service.liftAllRestrictions('fiscalisation-a', 'admin-1');

    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: expect.objectContaining({ isRestricted: false, liftedById: 'admin-1' }) });
    expect(logAction).toHaveBeenCalledWith('fiscalisation-a', 'RESTRICTION_LIFTED', 'admin-1', 'ADMIN', null, null, { count: 2 });
  });

  it('reports products as blocked only while the NEW_PRODUCTS restriction is active', async () => {
    const findFirst = jest.fn().mockResolvedValueOnce({ id: 'r1' }).mockResolvedValueOnce(null);
    const prisma = { storeRestriction: { findFirst } } as never;
    const service = new StoreRestrictionService(prisma, { logAction: jest.fn() } as never);

    await expect(service.canPublishProducts('fiscalisation-a')).resolves.toBe(false);
    await expect(service.canPublishProducts('fiscalisation-a')).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith({ where: { fiscalisationId: 'fiscalisation-a', restrictionType: 'NEW_PRODUCTS', isRestricted: true } });
  });
});
