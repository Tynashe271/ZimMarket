import { ComplianceAuditService } from './compliance-audit.service';

describe('ComplianceAuditService', () => {
  it('records a full audit entry with actor, statuses and details', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new ComplianceAuditService({ complianceAuditLog: { create } } as never);

    await service.logAction('fiscalisation-a', 'STATUS_CHANGED', 'user-1', 'BUSINESS_OWNER', 'DRAFT', 'PENDING_VERIFICATION', { note: 'submitted' }, '127.0.0.1', 'jest');

    expect(create).toHaveBeenCalledWith({
      data: {
        fiscalisationId: 'fiscalisation-a',
        action: 'STATUS_CHANGED',
        actorId: 'user-1',
        actorType: 'BUSINESS_OWNER',
        previousStatus: 'DRAFT',
        newStatus: 'PENDING_VERIFICATION',
        details: { note: 'submitted' },
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    });
  });

  it('swallows database failures so a failed audit write never blocks the caller', async () => {
    const create = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const service = new ComplianceAuditService({ complianceAuditLog: { create } } as never);

    await expect(service.logAction('fiscalisation-a', 'SUBMITTED', 'user-1', 'BUSINESS_OWNER', null, 'PENDING_VERIFICATION')).resolves.toBeUndefined();
  });

  it('returns the timeline for a fiscalisation ordered chronologically', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'log-1', timestamp: new Date('2026-01-01T00:00:00Z') }]);
    const service = new ComplianceAuditService({ complianceAuditLog: { findMany } } as never);

    const timeline = await service.getComplianceTimeline('fiscalisation-a');

    expect(findMany).toHaveBeenCalledWith({ where: { fiscalisationId: 'fiscalisation-a' }, orderBy: { timestamp: 'asc' } });
    expect(timeline[0].timestamp).toBe('2026-01-01T00:00:00.000Z');
  });
});
