import { AssistantService } from './assistant.service';

function makePrisma({ products = [], businesses = [], services = [] }: { products?: unknown[]; businesses?: unknown[]; services?: unknown[] } = {}) {
  return {
    product: { findMany: jest.fn().mockResolvedValue(products) },
    business: { findMany: jest.fn().mockResolvedValue(businesses) },
    service: { findMany: jest.fn().mockResolvedValue(services) },
  } as never;
}

describe('AssistantService without an OpenAI key configured', () => {
  it('falls back to the local catalog assistant', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const service = new AssistantService(makePrisma(), config as never);

    const result = await service.reply('hello there');

    expect(result.mode).toBe('local');
    expect(result.reply).toMatch(/Zim/);
  });

  it('answers a product question using the live catalog', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const products = [{ name: 'Maputi Snacks', description: 'Crunchy maize snack', price: 2.5, business: { name: 'Harare Traders' } }];
    const service = new AssistantService(makePrisma({ products }), config as never);

    const result = await service.reply('do you sell maputi snacks?');

    expect(result.mode).toBe('local');
    expect(result.reply).toContain('Maputi Snacks');
    expect(result.reply).toContain('Harare Traders');
  });

  it('tells the customer the catalog is empty when nothing matches and no products exist', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const service = new AssistantService(makePrisma(), config as never);

    const result = await service.reply('do you have televisions?');

    expect(result.reply).toMatch(/currently empty/);
  });
});
