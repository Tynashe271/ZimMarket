import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { GrowthService } from './growth.service';

describe('GrowthService customer features', () => {
  it('blocks a non-customer account from following a product', async () => {
    const findFirst = jest.fn();
    const service = new GrowthService({ product: { findFirst } } as never, {} as never);
    await expect(service.follow('user-a', AccountType.BUSINESS, 'product-a')).rejects.toBeInstanceOf(ForbiddenException);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('refuses to reserve stock beyond what is available', async () => {
    const transaction = jest.fn().mockImplementation(async (callback) =>
      callback({ branchInventory: { findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 5, reserved: 4 }), update: jest.fn() }, reservation: { create: jest.fn() } }),
    );
    const reservationExpiry = jest.fn();
    const service = new GrowthService({ $transaction: transaction } as never, { reservationExpiry } as never);

    await expect(service.reserve('user-a', AccountType.CUSTOMER, 'product-a', 'branch-a', 3, 1)).rejects.toBeInstanceOf(BadRequestException);
    expect(reservationExpiry).not.toHaveBeenCalled();
  });

  it('reserves available stock and schedules its expiry', async () => {
    const update = jest.fn();
    const create = jest.fn().mockResolvedValue({ id: 'reservation-1' });
    const transaction = jest.fn().mockImplementation(async (callback) =>
      callback({ branchInventory: { findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 5, reserved: 0 }), update }, reservation: { create } }),
    );
    const reservationExpiry = jest.fn();
    const service = new GrowthService({ $transaction: transaction } as never, { reservationExpiry } as never);

    const reservation = await service.reserve('user-a', AccountType.CUSTOMER, 'product-a', 'branch-a', 2, 1);

    expect(reservation).toEqual({ id: 'reservation-1' });
    expect(update).toHaveBeenCalledWith({ where: { id: 'inv-1' }, data: { reserved: { increment: 2 } } });
    expect(reservationExpiry).toHaveBeenCalledWith('reservation-1', 3_600_000);
  });

  it('rejects a business action from a member without the required role', async () => {
    const findUnique = jest.fn().mockResolvedValue({ role: 'SALES' });
    const service = new GrowthService({ businessMember: { findUnique } } as never, {} as never);
    await expect(service.wholesale('staff', 'business-a', { title: 't', description: 'd', minimumOrder: 1 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('notifies followers who were watching for a price drop', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'price-1' });
    const findMany = jest.fn().mockResolvedValue([{ customerId: 'follower-1' }]);
    const updateMany = jest.fn();
    const alert = jest.fn();
    const prisma = {
      businessMember: { findUnique: jest.fn().mockResolvedValue({ role: 'MANAGER' }) },
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'product-a', businessId: 'business-a' }) },
      productPrice: { upsert },
      productFollow: { findMany, updateMany },
    };
    const service = new GrowthService(prisma as never, { alert } as never);

    await service.price('owner', 'business-a', 'product-a', 'usd', 10);

    expect(alert).toHaveBeenCalledWith('follower-1', 'PRICE_DROP', 'product-a');
    expect(updateMany).toHaveBeenCalledWith({ where: { productId: 'product-a' }, data: { lastPrice: 10 } });
  });

  it('refuses to price a product that does not belong to the business', async () => {
    const prisma = { businessMember: { findUnique: jest.fn().mockResolvedValue({ role: 'MANAGER' }) }, product: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new GrowthService(prisma as never, {} as never);
    await expect(service.price('owner', 'business-a', 'missing-product', 'usd', 10)).rejects.toBeInstanceOf(NotFoundException);
  });
});
