import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, BusinessRole, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { SubscriptionPolicyService } from '../subscriptions/subscription-policy.service';
import { StoreRestrictionService } from '../compliance/store-restriction.service';

const productManagers: BusinessRole[] = [BusinessRole.OWNER, BusinessRole.MANAGER, BusinessRole.INVENTORY];

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: SubscriptionPolicyService,
    private readonly restrictionService: StoreRestrictionService,
  ) {}

  listPublic() {
    return this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, business: { status: 'ACTIVE', fiscalisation: { is: { status: { in:['COMPLIANT','EXPIRING_SOON'] }, taxpayerActive:true,deviceActive:true,deviceRegistered:true,receiptVerifiedAt:{not:null},taxClearanceExpiresAt:{gt:new Date()} } } } },
      // Public discovery exposes availability through active publication only. Exact
      // stock quantities remain private to authorized staff and customer checkout.
      select: { id: true, name: true, slug: true, description: true, price: true, business: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listStorefront(accountType: string) {
    if (accountType !== AccountType.CUSTOMER) throw new ForbiddenException('Approved customer account required');
    return this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, business: { status: 'ACTIVE', fiscalisation: { is: { status: { in:['COMPLIANT','EXPIRING_SOON'] }, taxpayerActive:true,deviceActive:true,deviceRegistered:true,receiptVerifiedAt:{not:null},taxClearanceExpiresAt:{gt:new Date()} } } } },
      select: {
        id: true, name: true, slug: true, description: true, price: true,
        business: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForBusiness(userId: string, businessId: string) {
    await this.requireMembership(userId, businessId);
    return this.prisma.product.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
  }

  async create(userId: string, businessId: string, dto: CreateProductDto) {
    await this.requireMembership(userId, businessId, productManagers);
    
    // Check compliance restrictions
    const business = await this.prisma.business.findUnique({ 
      where: { id: businessId }, 
      include: { fiscalisation: true } 
    });
    
    if (dto.status === ProductStatus.ACTIVE) {
      if (!business?.fiscalisation) {
        throw new ForbiddenException('ZIMRA registration required. Obtain or update your compliance through ZIMRA/TaRMS, then submit your TIN, Tax Clearance Certificate and fiscalisation evidence.');
      }
      
      // Check if business can publish products
      const canPublish = await this.restrictionService.canPublishProducts(business.fiscalisation.id);
      if (!canPublish) {
        throw new ForbiddenException('Your business cannot publish new products due to compliance restrictions. Please complete your compliance requirements to restore publishing access.');
      }
      
      if(business.fiscalisation.taxClearanceExpiresAt<=new Date()) {
        throw new ForbiddenException('Your Tax Clearance Certificate has expired. Obtain or update it through ZIMRA/TaRMS before publishing.');
      }
      
      if(business.status!=='ACTIVE'||!['COMPLIANT','EXPIRING_SOON'].includes(business.fiscalisation.status)||!business.fiscalisation.taxpayerActive||!business.fiscalisation.deviceActive||!business.fiscalisation.deviceRegistered||!business.fiscalisation.receiptVerifiedAt) {
        throw new ForbiddenException('ZIMRA registration and fiscalisation verification are incomplete. Products may only be saved as drafts.');
      }
    }
    
    await this.plans.productCapacity(businessId);
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: { ...dto, businessId } });
      await tx.auditLog.create({
        data: { actorId: userId, businessId, action: 'product.create', resource: 'Product', resourceId: product.id },
      });
      return product;
    });
  }

  private async requireMembership(userId: string, businessId: string, roles?: BusinessRole[]) {
    const membership = await this.prisma.businessMember.findUnique({
      where: { userId_businessId: { userId, businessId } },
    });
    if (!membership) throw new NotFoundException('Business not found');
    if (roles && !roles.includes(membership.role)) throw new ForbiddenException('Insufficient business permission');
    return membership;
  }
}
