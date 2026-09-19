import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BusinessRole } from '@prisma/client';
import { ComplianceService } from './compliance.service';

function makeService(prisma: unknown) {
  return new ComplianceService(prisma as never, {} as never, {} as never, { logAction: jest.fn() } as never, {} as never);
}

describe('ComplianceService access control', () => {
  it('blocks non-members from reading a business compliance status', async () => {
    const prisma = { businessMember: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = makeService(prisma);
    await expect(service.getComplianceStatus('outsider', 'business-a')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks staff without OWNER/MANAGER role from submitting compliance evidence', async () => {
    const findUniqueOrThrow = jest.fn();
    const prisma = { businessMember: { findUnique: jest.fn().mockResolvedValue({ role: BusinessRole.SALES }) }, businessFiscalisation: { findUnique: findUniqueOrThrow } };
    const service = makeService(prisma);
    await expect(service.submitCompliance('staff', 'business-a', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('reports no submission when a business has never filed compliance evidence', async () => {
    const prisma = {
      businessMember: { findUnique: jest.fn().mockResolvedValue({ role: BusinessRole.OWNER }) },
      businessFiscalisation: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = makeService(prisma);
    const status = await service.getComplianceStatus('owner', 'business-a');
    expect(status).toMatchObject({ hasSubmission: false, status: 'NONE', canTrade: false });
  });

  it('rejects an upload against a compliance record that does not exist', async () => {
    const prisma = { businessFiscalisation: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = makeService(prisma);
    await expect(service.uploadDocument('owner', { fiscalisationId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
