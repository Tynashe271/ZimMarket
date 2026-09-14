import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService tenant isolation', () => {
  it('conceals a business when the user has no membership', async () => {
    const prisma = { businessMember: { findUnique: jest.fn().mockResolvedValue(null) }, product: { findMany: jest.fn() } } as never;
    const service = new ProductsService(prisma, {} as never, {} as never);
    await expect(service.listForBusiness('user-a', 'business-b')).rejects.toBeInstanceOf(NotFoundException);
    expect((prisma as any).product.findMany).not.toHaveBeenCalled();
  });

  it('public projection never selects private inventory fields', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ProductsService({ product: { findMany } } as never, {} as never, {} as never);
    await service.listStorefront('CUSTOMER');
    const select = findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('costPrice');
    expect(select).not.toHaveProperty('stockQuantity');
  });

  it('anonymous public discovery never selects exact stock quantities', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ProductsService({ product: { findMany } } as never, {} as never, {} as never);
    await service.listPublic();
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty('stockQuantity');
  });

  it('blocks business accounts from customer storefronts', async () => {
    const service = new ProductsService({ product: { findMany: jest.fn() } } as never, {} as never, {} as never);
    expect(() => service.listStorefront('BUSINESS')).toThrow(ForbiddenException);
  });
});
