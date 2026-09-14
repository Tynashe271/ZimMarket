import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService moderation', () => {
  it('blocks every moderation action for a non-admin account type', async () => {
    const service = new AdminService({} as never);
    await expect(service.business('actor', 'CUSTOMER', 'business-a', 'ACTIVE' as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(() => service.tickets('CUSTOMER')).toThrow(ForbiddenException);
  });

  it('refuses to activate a business whose fiscal compliance has not passed', async () => {
    const update = jest.fn();
    const prisma = { businessFiscalisation: { findUnique: jest.fn().mockResolvedValue({ status: 'PENDING_VERIFICATION', taxpayerActive: false }) }, business: { update } };
    const service = new AdminService(prisma as never);

    await expect(service.business('admin-1', 'ADMIN', 'business-a', 'ACTIVE' as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('activates a business once every fiscal compliance check has passed', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'business-a', status: 'ACTIVE' });
    const create = jest.fn();
    const prisma = {
      businessFiscalisation: {
        findUnique: jest.fn().mockResolvedValue({ status: 'COMPLIANT', taxpayerActive: true, deviceActive: true, deviceRegistered: true, receiptVerifiedAt: new Date(), taxClearanceExpiresAt: new Date(Date.now() + 86_400_000) }),
      },
      business: { update },
      auditLog: { create },
    };
    const service = new AdminService(prisma as never);

    await service.business('admin-1', 'ADMIN', 'business-a', 'ACTIVE' as never);

    expect(update).toHaveBeenCalledWith({ where: { id: 'business-a' }, data: { status: 'ACTIVE' } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'business.moderate' }) }));
  });

  it('marks a document reviewed and audits the moderation action', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'doc-1' });
    const create = jest.fn();
    const prisma = { document: { update }, auditLog: { create } };
    const service = new AdminService(prisma as never);

    await service.document('admin-1', 'ADMIN', 'doc-1', 'APPROVED' as never);

    expect(update).toHaveBeenCalledWith({ where: { id: 'doc-1' }, data: { status: 'APPROVED', reviewedAt: expect.any(Date) } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'document.review', resource: 'Document', resourceId: 'doc-1' }) }));
  });
});
