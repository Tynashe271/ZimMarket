import { ForbiddenException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { OperationsService } from './operations.service';

describe('OperationsService storefront isolation', () => {
  it('blocks a business account from a competing business storefront', async () => {
    const prisma = {
      businessMember: { findFirst: jest.fn().mockResolvedValue(null) },
      business: { findFirst: jest.fn() },
    } as never;
    const service = new OperationsService(prisma, {} as never);

    await expect(service.storefront('vendor-user', AccountType.BUSINESS, 'competitor-shop'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect((prisma as any).businessMember.findFirst).toHaveBeenCalledWith({
      where: { userId: 'vendor-user', business: { slug: 'competitor-shop' } },
    });
    expect((prisma as any).business.findFirst).not.toHaveBeenCalled();
  });

  it('allows a business account to preview only its own storefront', async () => {
    const business = { id: 'business-a', name: 'Own Shop', slug: 'own-shop', branches: [], products: [], services: [], ads: [] };
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      businessMember: { findFirst: jest.fn().mockResolvedValue({ id: 'membership-a' }) },
      business: { findFirst: jest.fn().mockResolvedValue(business) },
      review: {
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: null }, _count: 0 }),
      },
      withSystemContext: jest.fn((fn: (tx: unknown) => unknown) => fn({ review: { findMany } })),
    } as never;
    const service = new OperationsService(prisma, {} as never);

    await expect(service.storefront('vendor-user', AccountType.BUSINESS, 'own-shop'))
      .resolves.toMatchObject({ id: 'business-a', slug: 'own-shop' });
  });
});
