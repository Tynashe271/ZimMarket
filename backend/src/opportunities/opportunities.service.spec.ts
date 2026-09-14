import { OpportunitiesService } from './opportunities.service';

describe('Private quotation isolation', () => {
  it('scopes quote comparison to the authenticated customer request', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new OpportunitiesService({ customerRequest: { findMany } } as never, {} as never);
    await service.mine('customer-a');
    expect(findMany.mock.calls[0][0].where).toEqual({ customerId: 'customer-a' });
    expect(findMany.mock.calls[0][0].include.quotes).toBeDefined();
  });
});
