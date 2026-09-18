import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { ExperienceService } from './experience.service';

describe('ExperienceService', () => {
  it('blocks staff without a manager-eligible role from creating a service', async () => {
    const findUnique = jest.fn();
    const service = new ExperienceService({ businessMember: { findUnique: jest.fn().mockResolvedValue({ role: 'SALES' }) }, business: { findUnique } } as never);

    await expect(service.createService('staff', 'business-a', { name: 'Haircut', category: 'Beauty', durationMinutes: 30 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('refuses to publish a service while business compliance is unapproved', async () => {
    const prisma = {
      businessMember: { findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }) },
      business: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE', fiscalisation: { status: 'EXPIRED' } }) },
    };
    const service = new ExperienceService(prisma as never);

    await expect(service.createService('owner', 'business-a', { name: 'Haircut', category: 'Beauty', durationMinutes: 30 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a booking attempt from a non-customer account', async () => {
    const service = new ExperienceService({} as never);
    await expect(service.book('user-a', AccountType.BUSINESS, 'service-a', undefined, new Date())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reports the store unavailable when the service is not currently bookable', async () => {
    const service = new ExperienceService({ service: { findFirst: jest.fn().mockResolvedValue(null) } } as never);
    await expect(service.book('user-a', AccountType.CUSTOMER, 'service-a', undefined, new Date())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a booking that clashes with an existing appointment', async () => {
    const prisma = {
      service: { findFirst: jest.fn().mockResolvedValue({ id: 'service-a', durationMinutes: 30 }) },
      booking: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new ExperienceService(prisma as never);

    await expect(service.book('user-a', AccountType.CUSTOMER, 'service-a', undefined, new Date())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a review for a purchase that was not delivered', async () => {
    const withContext = jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn({ order: { findFirst: jest.fn().mockResolvedValue(null) } }));
    const service = new ExperienceService({ withContext } as never);
    await expect(service.review('user-a', 'order-a', 5, 'Great service')).rejects.toBeInstanceOf(BadRequestException);
  });
});
