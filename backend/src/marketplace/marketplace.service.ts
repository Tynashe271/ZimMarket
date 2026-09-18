import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, AdStatus, BusinessRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPolicyService } from '../subscriptions/subscription-policy.service';
import { ProviderGateway } from '../providers/provider.gateway';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly plans: SubscriptionPolicyService, private readonly providers: ProviderGateway, private readonly jobs: JobsService) {}
  async createAd(userId: string, businessId: string, productId: string, title: string) {
    await this.member(userId, businessId, [BusinessRole.OWNER, BusinessRole.MANAGER, BusinessRole.MARKETING]);
    await this.plans.require(businessId, 'ADS');
    const business=await this.prisma.business.findUnique({where:{id:businessId},include:{fiscalisation:true}});if(!business||business.status!=='ACTIVE'||!['COMPLIANT','EXPIRING_SOON'].includes(business.fiscalisation?.status||''))throw new ForbiddenException('Advertisements cannot be submitted while business compliance is incomplete or expired');
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.advertisement.create({ data: { businessId, productId, title, status: AdStatus.PENDING_REVIEW } });
  }
  publicAds() {
    const now = new Date();
    return this.prisma.advertisement.findMany({
      where: { status:AdStatus.ACTIVE,business:{status:'ACTIVE',fiscalisation:{is:{status:{in:['COMPLIANT','EXPIRING_SOON']},taxClearanceExpiresAt:{gt:now},taxpayerActive:true,deviceActive:true,deviceRegistered:true,receiptVerifiedAt:{not:null}}}}, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
      select: { id: true, title: true, endsAt: true, product: { select: { id: true, name: true, slug: true, description: true, price: true } }, business: { select: { name: true, slug: true } } },
    });
  }
  async openConversation(userId: string, accountType: string, businessId: string, orderId?: string) {
    if (accountType !== AccountType.CUSTOMER) throw new ForbiddenException('Customer account required');
    if (orderId) {
      const order = await this.prisma.withContext({ userId, accountType }, tx => tx.order.findFirst({ where: { id: orderId, customerId: userId, businessId } }));
      if (!order) throw new NotFoundException('Order not found');
    }
    const existing = await this.prisma.conversation.findFirst({ where: { customerId: userId, businessId, orderId: orderId || null } });
    return existing || this.prisma.conversation.create({ data: { customerId: userId, businessId, orderId } });
  }
  conversations(userId: string, accountType: string) {
    // Conversation itself isn't RLS-protected, but the joined `customer` field
    // is a User row -- Postgres enforces User's RLS policy on that join
    // regardless, so this still needs the session context set.
    const where = accountType === AccountType.ADMIN ? { escalatedAt: { not: null } } : accountType === AccountType.CUSTOMER ? { customerId: userId } : { business: { members: { some: { userId } } } };
    return this.prisma.withContext({ userId, accountType }, tx => tx.conversation.findMany({ where, include: { business: { select: { id: true, name: true } }, customer: { select: { id: true, fullName: true, phone: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, senderId: true, body: true, createdAt: true, deletedAt: true } } }, orderBy: { updatedAt: 'desc' } }));
  }
  async messages(userId: string, accountType: string, conversationId: string) {
    await this.conversationAccess(userId, accountType, conversationId);
    const messages = await this.prisma.withContext({ userId, accountType }, tx => tx.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take: 200, include: { sender: { select: { id: true, fullName: true, accountType: true } } } }));
    return messages.reverse().map(message => message.deletedAt ? { ...message, body: '', attachmentKey: null } : message);
  }
  async sendMessage(userId: string, accountType: string, conversationId: string, body: string) {
    const conversation = await this.conversationAccess(userId, accountType, conversationId);
    const cleanBody = body.trim();
    if (!cleanBody) throw new ForbiddenException('Message cannot be empty');
    const message = await this.prisma.withContext({ userId, accountType }, async tx => { const created = await tx.message.create({ data: { senderId: userId, conversationId, body: cleanBody } }); await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }); return created; });
    // In-app storage above is the "internal" side; queue an SMS/email alert too
    // (the "external" side) so the other party isn't only notified by reopening
    // the app. Recipients are whoever didn't send this message.
    const recipientIds = userId === conversation.customerId
      ? (await this.prisma.businessMember.findMany({ where: { businessId: conversation.businessId }, select: { userId: true } })).map(member => member.userId)
      : [conversation.customerId];
    await Promise.all(recipientIds.filter(id => id !== userId).map(id => this.jobs.newMessage(id, conversationId)));
    return message;
  }
  async escalateConversation(userId: string, accountType: string, conversationId: string) {
    if (accountType === AccountType.ADMIN) throw new ForbiddenException('Conversation is already available to administrators');
    await this.conversationAccess(userId, accountType, conversationId);
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { escalatedAt: new Date() } });
  }
  async deleteMessage(userId: string, accountType: string, conversationId: string, messageId: string) {
    await this.conversationAccess(userId, accountType, conversationId);
    return this.prisma.withContext({ userId, accountType }, async tx => {
      const message = await tx.message.findFirst({ where: { id: messageId, conversationId } });
      if (!message) throw new NotFoundException('Message not found');
      if (message.senderId !== userId && accountType !== AccountType.ADMIN) throw new ForbiddenException('You can only delete your own messages');
      await tx.message.update({ where: { id: messageId }, data: { body: '', attachmentKey: null, deletedAt: new Date() } });
      return { deleted: true };
    });
  }
  async createDocument(userId: string, businessId: string | undefined, data: { type: string; storageKey: string; mimeType: string; sizeBytes: number }) {
    if (businessId) await this.member(userId, businessId, [BusinessRole.OWNER, BusinessRole.MANAGER]);
    const scan=await this.providers.scan(data.storageKey,data.mimeType);if(!scan.clean)throw new ForbiddenException('Document failed malware scan');
    return this.prisma.document.create({ data: { ...data, ownerId: userId, businessId } });
  }
  documentUpload(userId:string,storageKey:string,mimeType:string){if(!storageKey.startsWith(`${userId}/`))throw new ForbiddenException('Storage key must be user scoped');return this.providers.signedUpload(storageKey,mimeType)}
  async documentDownload(userId:string,id:string){const document=await this.prisma.document.findFirst({where:{id,OR:[{ownerId:userId},{business:{members:{some:{userId}}}}]}});if(!document)throw new NotFoundException('Document not found');await this.prisma.auditLog.create({data:{actorId:userId,businessId:document.businessId,action:'document.read',resource:'Document',resourceId:id}});return this.providers.signedDownload(document.storageKey)}
  report(userId: string, data: { subjectUserId?: string; businessId?: string; reason: string; details?: string }) {
    return this.prisma.report.create({ data: { ...data, reporterId: userId } });
  }
  async whatsappShare(userId:string,businessId:string,productId:string){await this.member(userId,businessId,[BusinessRole.OWNER,BusinessRole.MANAGER,BusinessRole.MARKETING,BusinessRole.SALES]);const product=await this.prisma.product.findFirst({where:{id:productId,businessId}});if(!product)throw new NotFoundException('Product not found');const link=`${this.config.get('APP_PUBLIC_URL','http://localhost:3001')}/products/${product.slug}`;return{productLink:link,whatsappShareUrl:`https://wa.me/?text=${encodeURIComponent(`${product.name} - ${link}`)}`}}
  private async conversationAccess(userId: string, accountType: string, id: string) {
    const scope = accountType === AccountType.ADMIN ? { escalatedAt: { not: null } } : { OR: [{ customerId: userId }, { business: { members: { some: { userId } } } }] };
    const conversation = await this.prisma.conversation.findFirst({ where: { id, ...scope } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }
  private async member(userId: string, businessId: string, roles: BusinessRole[]) {
    const member = await this.prisma.businessMember.findUnique({ where: { userId_businessId: { userId, businessId } } });
    if (!member) throw new NotFoundException('Business not found');
    if (!roles.includes(member.role)) throw new ForbiddenException('Insufficient permission');
  }
}
