import { JobsService } from './jobs.service';

describe('JobsService queueing', () => {
  it('schedules a verification job with retry backoff', () => {
    const add = jest.fn();
    const service = new JobsService({ add } as never);

    service.verification('user-a', 'EMAIL', '123456');

    expect(add).toHaveBeenCalledWith('verification', { userId: 'user-a', type: 'EMAIL', code: '123456' }, expect.objectContaining({ attempts: 5, backoff: { type: 'exponential', delay: 1000 } }));
  });

  it('schedules a reservation-expiry job with the requested delay', () => {
    const add = jest.fn();
    const service = new JobsService({ add } as never);

    service.reservationExpiry('reservation-1', 3_600_000);

    expect(add).toHaveBeenCalledWith('reservation-expire', { reservationId: 'reservation-1' }, expect.objectContaining({ delay: 3_600_000 }));
  });

  it('registers the recurring birthday and compliance-expiry scans on module init', async () => {
    const add = jest.fn();
    const service = new JobsService({ add } as never);

    await service.onModuleInit();

    expect(add).toHaveBeenCalledWith('birthday-scan', {}, expect.objectContaining({ jobId: 'birthday-scan' }));
    expect(add).toHaveBeenCalledWith('compliance-expiry-scan', {}, expect.objectContaining({ jobId: 'compliance-expiry-scan' }));
  });
});
