import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'; import { AccountType, BusinessRole, Prisma, QuoteStatus } from '@prisma/client'; import { JobsService } from '../jobs/jobs.service'; import { PrismaService } from '../prisma/prisma.service'; import { PaginationQueryDto, paginate } from '../common/pagination.dto';
@Injectable() export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService) {}
  async createRequest(userId: string, accountType: string, data: { title: string; details: string; category: string; city?: string; province?: string; budget?: number; currency?: string; quantity?: number; expiresAt?: Date }) {
    if (accountType !== AccountType.CUSTOMER) throw new ForbiddenException('Customer account required');
    const request = await this.prisma.customerRequest.create({ data: { ...data, customerId: userId, budget: data.budget == null ? undefined : new Prisma.Decimal(data.budget), currency: data.currency?.toUpperCase() } });
    const members = await this.prisma.businessMember.findMany({ where: { business: { status: 'ACTIVE', OR: [{ industry: { equals: data.category, mode: 'insensitive' } }, { products: { some: { name: { contains: data.category, mode: 'insensitive' } } } }] } }, select: { userId: true } });
    await Promise.all(members.map(m => this.jobs.opportunity(m.userId, request.id, request.category))); return request;
  }
  mine(userId: string) { return this.prisma.customerRequest.findMany({ where: { customerId: userId }, include: { quotes: { include: { business: { select: { name: true, slug: true, verificationLevel: true } }, items: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }); }
  async relevant(userId: string, businessId: string, query: PaginationQueryDto = {}) {
    const business = await this.member(userId, businessId); return this.prisma.customerRequest.findMany({ where: { status: 'OPEN', ...(business.industry ? { category: { equals: business.industry, mode: 'insensitive' } } : {}) }, select: { id: true, title: true, details: true, category: true, city: true, province: true, budget: true, currency: true, quantity: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, ...paginate(query) });
  }
  async quote(userId: string, businessId: string, requestId: string, data: { amount: number; currency: string; message?: string; validUntil: Date; items?: { productId?: string; description: string; quantity: number; unitPrice: number }[] }) {
    await this.member(userId,businessId,[BusinessRole.OWNER,BusinessRole.MANAGER,BusinessRole.FINANCE]); const request = await this.prisma.customerRequest.findFirst({ where: { id: requestId, status: 'OPEN' } }); if (!request) throw new NotFoundException('Request not found');
    return this.prisma.quote.create({ data: { businessId, requestId, amount: new Prisma.Decimal(data.amount), currency: data.currency.toUpperCase(), message: data.message, validUntil: data.validUntil, items: { create: data.items?.map(i => ({ ...i, unitPrice: new Prisma.Decimal(i.unitPrice) })) ?? [] } }, include: { items: true } });
  }
  async accept(userId: string, requestId: string, quoteId: string) {
    const request = await this.prisma.customerRequest.findFirst({ where: { id: requestId, customerId: userId }, include: { quotes: true } }); if (!request) throw new NotFoundException('Request not found'); if (!request.quotes.some(q => q.id === quoteId)) throw new NotFoundException('Quote not found');
    return this.prisma.$transaction([this.prisma.quote.update({ where: { id: quoteId }, data: { status: QuoteStatus.ACCEPTED } }), this.prisma.quote.updateMany({ where: { requestId, id: { not: quoteId } }, data: { status: QuoteStatus.REJECTED } }), this.prisma.customerRequest.update({ where: { id: requestId }, data: { status: 'AWARDED' } })]);
  }
  private async member(userId: string,businessId: string,roles?: BusinessRole[]) { const m=await this.prisma.businessMember.findUnique({where:{userId_businessId:{userId,businessId}},include:{business:true}}); if(!m) throw new NotFoundException('Business not found'); if(roles&&!roles.includes(m.role)) throw new ForbiddenException('Insufficient permission'); return m.business; }
}
