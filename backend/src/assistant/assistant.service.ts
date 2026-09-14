import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

type CatalogProduct = { name: string; description: string | null; price: unknown; business: { name: string } };
type CatalogBusiness = { name: string; industry: string | null; branches: { city: string }[] };
type CatalogService = { name: string; category: string; price: unknown; currency: string | null; business: { name: string } };

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async reply(message: string) {
    const catalog = await this.catalog();
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (apiKey) {
      try {
        const client = new OpenAI({ apiKey });
        const response = await client.responses.create({
          model: this.config.get('OPENAI_MODEL', 'gpt-5.4'),
          store: false,
          max_output_tokens: 350,
          instructions: [
            'You are Zim, the concise and friendly ZimMarket shopping assistant.',
            'Only claim products, prices, services, locations, or businesses present in the supplied live catalog.',
            'Help users discover items and explain how to sign in, shop, contact a business, or use ZimMarket.',
            'Never request passwords, payment credentials, verification codes, or other secrets.',
            'If the catalog cannot answer a product availability question, say so clearly.',
          ].join(' '),
          input: `LIVE ZIMMARKET CATALOG:\n${JSON.stringify(catalog)}\n\nCUSTOMER QUESTION:\n${message}`,
        });
        if (response.output_text) return { reply: response.output_text, mode: 'ai' as const };
      } catch (error) {
        this.logger.warn(`OpenAI response unavailable; using local assistant: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    return { reply: this.localReply(message, catalog), mode: 'local' as const };
  }

  private catalog() {
    return Promise.all([
      this.prisma.product.findMany({ where: { status: 'ACTIVE', business: { status: 'ACTIVE' } }, take: 30, select: { name: true, description: true, price: true, business: { select: { name: true } } } }),
      this.prisma.business.findMany({ where: { status: 'ACTIVE' }, take: 30, select: { name: true, industry: true, branches: { select: { city: true } } } }),
      this.prisma.service.findMany({ where: { active: true, business: { status: 'ACTIVE' } }, take: 30, select: { name: true, category: true, price: true, currency: true, business: { select: { name: true } } } }),
    ]).then(([products, businesses, services]) => ({ products, businesses, services }));
  }

  private localReply(message: string, catalog: { products: CatalogProduct[]; businesses: CatalogBusiness[]; services: CatalogService[] }) {
    const query = message.toLowerCase();
    const productMatches = catalog.products.filter(item => `${item.name} ${item.description ?? ''} ${item.business.name}`.toLowerCase().split(/\s+/).some(word => word.length > 3 && query.includes(word)));
    const serviceMatches = catalog.services.filter(item => `${item.name} ${item.category} ${item.business.name}`.toLowerCase().split(/\s+/).some(word => word.length > 3 && query.includes(word)));
    if (/hello|hi\b|hey|howzit/.test(query)) return 'Hi! I’m Zim, your marketplace assistant. Ask me to find a product, service, business, or location.';
    if (/business|seller|store|shop/.test(query) && catalog.businesses.length) {
      return `You can explore ${catalog.businesses.slice(0, 4).map(item => `${item.name}${item.branches[0]?.city ? ` in ${item.branches[0].city}` : ''}`).join(', ')}. Use “Businesses worth knowing” to visit a store.`;
    }
    if (productMatches.length) return `I found ${productMatches.slice(0, 3).map(item => `${item.name} from ${item.business.name} for US$${Number(item.price).toFixed(2)}`).join('; ')}. Sign in as a customer to view live marketplace items.`;
    if (serviceMatches.length) return `Available services include ${serviceMatches.slice(0, 3).map(item => `${item.name} from ${item.business.name} for ${item.currency} ${Number(item.price).toFixed(2)}`).join('; ')}.`;
    if (/service|repair|booking|appointment/.test(query) && catalog.services.length) return `Current services include ${catalog.services.slice(0, 4).map(item => `${item.name} (${item.business.name})`).join(', ')}.`;
    if (/deliver|shipping|courier/.test(query)) return 'Delivery options are set by each business. Open a product or business, then check its delivery area before ordering.';
    if (/pay|payment|refund/.test(query)) return 'Payments and refunds are handled securely through ZimMarket. Never share a password or verification code in chat.';
    return catalog.products.length ? `I can help you explore products, services, businesses, delivery, and payments. For example, ask about ${catalog.products.slice(0, 2).map(item => item.name).join(' or ')}.` : 'I can help with products, services, businesses, delivery, and payments. The live catalog is currently empty, so try again after marketplace data is added.';
  }
}
