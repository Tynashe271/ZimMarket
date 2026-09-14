import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, AvailabilityStatus, BusinessRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPolicyService } from '../subscriptions/subscription-policy.service';

const management: BusinessRole[] = [BusinessRole.OWNER, BusinessRole.MANAGER];
const inventoryRoles: BusinessRole[] = [...management, BusinessRole.INVENTORY];

@Injectable() export class OperationsService {
  constructor(private readonly prisma: PrismaService, private readonly plans: SubscriptionPolicyService) {}

  async createBranch(userId: string, businessId: string, data: { name: string; province: string; city: string; suburb?: string; deliveryAreas?: string[]; operatingHours?: object }) {
    await this.member(userId, businessId, management);
    await this.plans.require(businessId, 'BRANCHES');
    return this.prisma.branch.create({ data: { ...data, deliveryAreas: data.deliveryAreas ?? [], businessId } });
  }
  discover(city?: string, province?: string, tag?: string) {
    return this.prisma.business.findMany({ where: { status:'ACTIVE',fiscalisation:{is:{status:{in:['COMPLIANT','EXPIRING_SOON']},taxClearanceExpiresAt:{gt:new Date()},taxpayerActive:true,deviceActive:true,deviceRegistered:true,receiptVerifiedAt:{not:null}}}, ...(tag ? { communityTags: { has: tag } } : {}), branches: { some: { ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}), ...(province ? { province: { equals: province, mode: 'insensitive' } } : {}) } } }, select: { id: true, name: true, slug: true, industry: true, communityTags: true, verificationLevel: true, branches: { select: { id: true, name: true, province: true, city: true, suburb: true, deliveryAreas: true, operatingHours: true } } } });
  }
  async storefront(userId:string,accountType:string,slug: string) {
    if(accountType!==AccountType.CUSTOMER){const own=accountType===AccountType.BUSINESS&&await this.prisma.businessMember.findFirst({where:{userId,business:{slug}}});if(!own)throw new ForbiddenException('A customer account is required to enter this storefront');}
    const business = await this.prisma.business.findFirst({ where: { slug,status:'ACTIVE',fiscalisation:{is:{status:{in:['COMPLIANT','EXPIRING_SOON']},taxClearanceExpiresAt:{gt:new Date()},taxpayerActive:true,deviceActive:true,deviceRegistered:true,receiptVerifiedAt:{not:null}}} }, select: { id: true, name: true, slug: true, industry: true, communityTags: true, verificationLevel: true, branches: { select: { id: true, name: true, city: true, province: true, suburb: true, deliveryAreas: true, operatingHours:true } }, products: { where: { status: 'ACTIVE', stockQuantity: { gt: 0 } }, select: { id: true, name: true, slug: true, description: true, price: true }, orderBy: { createdAt: 'desc' } },services:{where:{active:true},select:{id:true,name:true,category:true,description:true,durationMinutes:true,price:true,currency:true}},ads:{where:{status:'ACTIVE'},select:{id:true,title:true,startsAt:true,endsAt:true}} } });
    if (!business) throw new NotFoundException('Shop not found');
    const [rating,reviews]=await Promise.all([this.prisma.review.aggregate({where:{businessId:business.id,hidden:false},_avg:{rating:true},_count:true}),this.prisma.review.findMany({where:{businessId:business.id,hidden:false},select:{id:true,rating:true,comment:true,createdAt:true,customer:{select:{fullName:true}}},orderBy:{createdAt:'desc'},take:20})]);
    return {...business,rating:{average:rating._avg.rating,count:rating._count},reviews};
  }
  async setInventory(userId: string, businessId: string, branchId: string, productId: string, data: { quantity: number; lowStockAt: number; availability: AvailabilityStatus; discloseQuantity: boolean }) {
    await this.member(userId, businessId, inventoryRoles, branchId);
    const [branch, product] = await Promise.all([this.prisma.branch.findFirst({ where: { id: branchId, businessId } }), this.prisma.product.findFirst({ where: { id: productId, businessId } })]);
    if (!branch || !product) throw new NotFoundException('Branch or product not found');
    return this.prisma.branchInventory.upsert({ where: { branchId_productId: { branchId, productId } }, create: { branchId, productId, ...data }, update: data });
  }
  async recordSale(userId: string, businessId: string, branchId: string, paymentMethod: string, currency: string, lines: { productId: string; quantity: number; unitPrice: number }[]) {
    await this.member(userId, businessId, [BusinessRole.OWNER, BusinessRole.MANAGER, BusinessRole.FINANCE, BusinessRole.SALES], branchId);
    await this.plans.require(businessId, 'POS');
    return this.prisma.$transaction(async tx => {
      let total = new Prisma.Decimal(0); const snapshots: { productId: string; productName: string; unitPrice: Prisma.Decimal; quantity: number }[] = [];
      for (const line of lines) {
        const inventory = await tx.branchInventory.findUnique({ where: { branchId_productId: { branchId, productId: line.productId } }, include: { product: true } });
        if (!inventory || inventory.quantity - inventory.reserved < line.quantity) throw new BadRequestException('Insufficient branch stock');
        const price = new Prisma.Decimal(line.unitPrice); total = total.add(price.mul(line.quantity));
        snapshots.push({ productId: line.productId, productName: inventory.product.name, unitPrice: price, quantity: line.quantity });
        const remaining = inventory.quantity - line.quantity;
        await tx.branchInventory.update({ where: { id: inventory.id }, data: { quantity: remaining, availability: remaining <= 0 ? 'UNAVAILABLE' : remaining <= inventory.lowStockAt ? 'LOW_STOCK' : 'AVAILABLE' } });
        await tx.product.update({ where: { id: line.productId }, data: { stockQuantity: { decrement: line.quantity } } });
      }
      const sale = await tx.sale.create({ data: { branchId, staffUserId: userId, paymentMethod, currency, total, items: { create: snapshots } }, include: { items: true } });
      await tx.auditLog.create({ data: { actorId: userId, businessId, action: 'pos.sale', resource: 'Sale', resourceId: sale.id } }); return sale;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async branchSummary(userId: string, businessId: string, branchId: string) {
    await this.member(userId, businessId, undefined, branchId);
    const [sales, inventory] = await Promise.all([
      this.prisma.sale.groupBy({ by: ['currency'], where: { branchId }, _sum: { total: true }, _count: true }),
      this.prisma.branchInventory.findMany({ where: { branchId }, include: { product: { select: { name: true, slug: true } } } }),
    ]); return { sales, inventory };
  }
  private async member(userId: string, businessId: string, roles?: BusinessRole[], branchId?: string) {
    const membership = await this.prisma.businessMember.findUnique({ where: { userId_businessId: { userId, businessId } }, include: { branches: true } });
    if (!membership) throw new NotFoundException('Business not found');
    if (roles && !roles.includes(membership.role)) throw new ForbiddenException('Insufficient permission');
    if (branchId && membership.role !== BusinessRole.OWNER && !membership.branches.some(x => x.branchId === branchId)) throw new ForbiddenException('Not assigned to this branch');
    return membership;
  }
}
