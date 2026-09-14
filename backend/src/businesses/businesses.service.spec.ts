import { ForbiddenException } from '@nestjs/common';
import { BusinessRole } from '@prisma/client';
import { BusinessesService } from './businesses.service';

describe('BusinessesService settings', () => {
  it('prevents non-members from reading settings', async () => {
    const prisma = { businessMember: { findUnique: jest.fn().mockResolvedValue(null) }, business: { findUniqueOrThrow: jest.fn() } } as never;
    const service = new BusinessesService(prisma, {} as never, {} as never);
    await expect(service.settings('outsider', 'business-a')).rejects.toBeInstanceOf(ForbiddenException);
    expect((prisma as any).business.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('prevents ordinary staff from changing settings', async () => {
    const prisma = { businessMember: { findUnique: jest.fn().mockResolvedValue({ role: BusinessRole.SALES }) }, $transaction: jest.fn() } as never;
    const service = new BusinessesService(prisma, {} as never, {} as never);
    await expect(service.updateSettings('staff', 'business-a', { storeName: 'Changed' })).rejects.toBeInstanceOf(ForbiddenException);
    expect((prisma as any).$transaction).not.toHaveBeenCalled();
  });

  it('persists owner settings and records an audit event', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'business-a', settings: { storeName: 'Vendor' } });
    const create = jest.fn().mockResolvedValue({});
    const prisma = { businessMember: { findUnique: jest.fn().mockResolvedValue({ role: BusinessRole.OWNER }) }, $transaction: jest.fn((callback) => callback({ business: { update }, auditLog: { create } })) } as never;
    const service = new BusinessesService(prisma, {} as never, {} as never);
    await service.updateSettings('owner', 'business-a', { storeName: 'Vendor' });
    expect(update).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'business.settings.update', businessId: 'business-a' }) }));
  });

  it('prevents managers from changing staff or permissions', async () => {
    const prisma = { businessMember: { findUnique: jest.fn().mockResolvedValue({ role: BusinessRole.MANAGER }) } } as never;
    const plans = { require: jest.fn(), staffCapacity: jest.fn() } as never;
    const service = new BusinessesService(prisma, plans, {} as never);
    await expect(service.addStaff('manager', 'business-a', '+263771234567', BusinessRole.SALES, [])).rejects.toBeInstanceOf(ForbiddenException);
    expect((plans as any).require).not.toHaveBeenCalled();
  });
});
