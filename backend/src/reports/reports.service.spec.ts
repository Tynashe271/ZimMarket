import { ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';

describe('ReportsService access control', () => {
  it('requires a reporting-eligible role before checking the subscription plan', async () => {
    const require = jest.fn();
    const findUnique = jest.fn().mockResolvedValue({ role: 'SALES' });
    const service = new ReportsService({ businessMember: { findUnique } } as never, {} as never, { require } as never);

    await expect(service.business('staff', 'business-a', new Date(), new Date())).rejects.toBeInstanceOf(ForbiddenException);
    expect(require).not.toHaveBeenCalled();
  });

  it('gates the advanced report behind the subscription plan for eligible staff', async () => {
    const require = jest.fn().mockRejectedValue(new ForbiddenException('Upgrade required'));
    const findUnique = jest.fn().mockResolvedValue({ role: 'OWNER' });
    const service = new ReportsService({ businessMember: { findUnique } } as never, {} as never, { require } as never);

    await expect(service.business('owner', 'business-a', new Date(), new Date())).rejects.toBeInstanceOf(ForbiddenException);
    expect(require).toHaveBeenCalledWith('business-a', 'ADVANCED_REPORTS');
  });

  it('exports a CSV report through the accounting provider', async () => {
    const groupBy = jest.fn().mockResolvedValue([]);
    const exportAccounting = jest.fn().mockResolvedValue({ format: 'CSV', payload: 'section,currency,status_or_branch,count,total' });
    const prisma = { businessMember: { findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }) }, order: { groupBy }, sale: { groupBy }, orderItem: { groupBy }, refundRequest: { groupBy }, auditLog: { groupBy }, advertisement: { groupBy } };
    const service = new ReportsService(prisma as never, { exportAccounting } as never, { require: jest.fn() } as never);

    await service.export('owner', 'business-a', new Date(), new Date(), 'CSV');

    expect(exportAccounting).toHaveBeenCalledWith('CSV', expect.stringContaining('section,currency,status_or_branch,count,total'));
  });
});
