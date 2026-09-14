import { ForbiddenException, Injectable } from '@nestjs/common';
import { AccountType, BusinessRole, FiscalisationMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPolicyService } from '../subscriptions/subscription-policy.service';
import { StoreRestrictionService } from '../compliance/store-restriction.service';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: SubscriptionPolicyService,
    private readonly restrictionService: StoreRestrictionService,
  ) {}
  list(userId: string) {
    return this.prisma.business.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: { select: { id: true, fullName: true, phone: true, email: true } },
            branches: { include: { branch: { select: { id: true, name: true } } } },
          },
        },
        branches: true,
        subscription: true,
        documents: true, fiscalisation: true,
      },
    });
  }
  async create(userId: string, accountType: string, name: string, slug: string) {
    if (accountType !== AccountType.BUSINESS) throw new ForbiddenException('Business account required');
    return this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({ data: { name, slug, members: { create: { userId, role: BusinessRole.OWNER } }, subscription: { create: { plan: 'FREE', status: 'ACTIVE' } } } });
      await tx.auditLog.create({ data: { actorId: userId, businessId: business.id, action: 'business.create', resource: 'Business', resourceId: business.id } });
      return business;
    });
  }
  async addStaff(actorId: string, businessId: string, phone: string, role: BusinessRole, branchIds: string[]) {
    const actor = await this.prisma.businessMember.findUnique({ where: { userId_businessId: { userId: actorId, businessId } } });
    if (!actor || actor.role !== BusinessRole.OWNER) throw new ForbiddenException('Business owner permission required to manage staff');
    await this.plans.require(businessId, 'STAFF'); await this.plans.staffCapacity(businessId);
    const user = await this.prisma.user.findUnique({ where: { phone } }); if (!user) throw new ForbiddenException('User must register before being added');
    return this.prisma.businessMember.upsert({ where: { userId_businessId: { userId: user.id, businessId } }, create: { userId: user.id, businessId, role, branches: { create: branchIds.map(branchId => ({ branchId })) } }, update: { role, branches: { deleteMany: {}, create: branchIds.map(branchId => ({ branchId })) } }, include: { user: { select: { id: true, fullName: true, phone: true, email: true } }, branches: { include: { branch: { select: { id: true, name: true } } } } } });
  }
  async settings(userId: string, businessId: string) {
    await this.requireMember(userId, businessId);
    return this.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { id: true, name: true, status: true, settings: true, fiscalisation: true, branches: true, members: true, products: { select: { id: true } }, services: { select: { id: true } }, ads: { select: { id: true } } } });
  }
  async updateSettings(userId: string, businessId: string, settings: Prisma.InputJsonValue) {
    const member = await this.requireMember(userId, businessId);
    const settingsManagers: BusinessRole[] = [BusinessRole.OWNER, BusinessRole.MANAGER];
    if (!settingsManagers.includes(member.role)) throw new ForbiddenException('Business settings permission required');
    return this.prisma.$transaction(async tx => {
      const business = await tx.business.update({ where: { id: businessId }, data: { settings }, select: { id: true, name: true, status: true, settings: true } });
      await tx.auditLog.create({ data: { actorId: userId, businessId, action: 'business.settings.update', resource: 'Business', resourceId: businessId, metadata: settings } });
      return business;
    });
  }
  async submitFiscalisation(userId:string,businessId:string,data:{registeredBusinessName:string;tradingName:string;tin:string;vatNumber?:string;taxClearanceCertificateNumber:string;taxClearanceIssuedAt:Date;taxClearanceExpiresAt:Date;taxClearanceDocumentKey:string;method:FiscalisationMethod;deviceIdentifier:string;deviceModel?:string;deviceSerialNumber?:string;virtualDeviceIdentifier?:string;approvedSupplierOrIntegrator:string;zimraRegistrationEvidenceKey:string;branchInformation:Record<string,unknown>;sampleFiscalReceiptKey:string;receiptVerificationCode:string;authorisedRepresentative:string}) {
    const member = await this.requireMember(userId, businessId);
    if (member.role !== BusinessRole.OWNER) throw new ForbiddenException('Only the business owner can submit ZIMRA fiscalisation evidence');
    if(data.taxClearanceExpiresAt<=data.taxClearanceIssuedAt)throw new ForbiddenException('Tax Clearance Certificate expiry must be after its issue date');
    return this.prisma.$transaction(async tx => {
      const existing=await tx.businessFiscalisation.findUnique({where:{businessId}});const fiscalisation=await tx.businessFiscalisation.upsert({where:{businessId},create:{businessId,...data,branchInformation:data.branchInformation as Prisma.InputJsonValue,status:'PENDING_VERIFICATION'},update:{...data,branchInformation:data.branchInformation as Prisma.InputJsonValue,status:existing?'RENEWAL_PENDING':'PENDING_VERIFICATION',taxpayerActive:false,deviceActive:false,deviceRegistered:false,receiptVerifiedAt:null,receiptVerificationReference:null,reviewedById:null,reviewedAt:null,rejectionReason:null,reminder30SentAt:null,reminder14SentAt:null,reminder7SentAt:null,reminder3SentAt:null,reminder1SentAt:null}});
      await tx.business.update({ where: { id: businessId }, data: { status: 'PENDING' } });
      await tx.product.updateMany({ where: { businessId, status: 'ACTIVE' }, data: { status: 'DRAFT' } });
      // Impose trading restrictions during compliance review
      await this.restrictionService.imposeTradingRestrictions(fiscalisation.id, 'Compliance under review');
      await tx.auditLog.create({ data: { actorId:userId,businessId,action:existing?'business.compliance.renewal.submit':'business.compliance.submit',resource:'BusinessFiscalisation',resourceId:fiscalisation.id,metadata:{method:data.method,taxClearanceExpiresAt:data.taxClearanceExpiresAt} } });
      return fiscalisation;
    });
  }
  async notifications(userId: string, businessId: string) {
    await this.requireMember(userId, businessId);
    const members = await this.prisma.businessMember.findMany({ where: { businessId }, include: { user: { select: { email: true, phone: true } } } });
    const recipients = members.flatMap(member => [member.user.email, member.user.phone]).filter((value): value is string => Boolean(value));
    const [messages, orders, lowStock] = await Promise.all([
      recipients.length ? this.prisma.notificationOutbox.findMany({ where: { recipient: { in: recipients } }, orderBy: { createdAt: 'desc' }, take: 50 }) : [],
      this.prisma.order.findMany({ where: { businessId }, select: { id: true, status: true, total: true, currency: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.product.findMany({ where: { businessId, stockQuantity: { lte: 5 } }, select: { id: true, name: true, stockQuantity: true, updatedAt: true }, take: 10 }),
    ]);
    return { messages, orderAlerts: orders, stockAlerts: lowStock };
  }
  async readNotification(userId: string, businessId: string, notificationId: string) {
    await this.requireMember(userId, businessId);
    const members = await this.prisma.businessMember.findMany({ where: { businessId }, include: { user: { select: { email: true, phone: true } } } });
    const recipients = members.flatMap(member => [member.user.email, member.user.phone]).filter((value): value is string => Boolean(value));
    const result = await this.prisma.notificationOutbox.updateMany({ where: { id: notificationId, recipient: { in: recipients } }, data: { readAt: new Date() } });
    if (!result.count) throw new ForbiddenException('Notification access denied');
    return { read: true };
  }
  private async requireMember(userId: string, businessId: string) {
    const member = await this.prisma.businessMember.findUnique({ where: { userId_businessId: { userId, businessId } } });
    if (!member) throw new ForbiddenException('Business access denied');
    return member;
  }
}
