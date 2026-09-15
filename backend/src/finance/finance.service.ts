import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountType, BusinessRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaynowProvider } from './paynow.provider';
import { createHmac, timingSafeEqual } from 'crypto';

const payoutRoles: BusinessRole[] = [BusinessRole.OWNER, BusinessRole.FINANCE];
const onlineMethods=['ECOCASH','ONEMONEY','INNBUCKS','OMARI','TELECASH','ZIMSWITCH','VISA_MASTERCARD','ZIPIT_BANK_TRANSFER','BANK_TRANSFER'];
const cashMethods=['CASH_ON_DELIVERY','CASH_ON_COLLECTION'];

@Injectable() export class FinanceService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly paynow: PaynowProvider) {}
  async initiatePayment(userId: string, accountType: string, orderId: string, provider: string, idempotencyKey: string) {
    if (accountType !== AccountType.CUSTOMER) throw new ForbiddenException('Customer account required');
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId: userId }, include: { business: { include: { fiscalisation: true } }, customer: { select: { email: true } } } });
    if (!order) throw new NotFoundException('Order not found');
    if(order.business.status!=='ACTIVE'||!order.business.fiscalisation||!['COMPLIANT','EXPIRING_SOON'].includes(order.business.fiscalisation.status)||!order.business.fiscalisation.taxpayerActive||!order.business.fiscalisation.deviceActive||!order.business.fiscalisation.receiptVerifiedAt)throw new ForbiddenException('This shop cannot accept payments while its tax or fiscalisation compliance is incomplete.');
    if(order.business.fiscalisation.taxClearanceExpiresAt<=new Date())throw new ForbiddenException('This shop is restricted because its Tax Clearance Certificate has expired.');
    if (!['PENDING','CONFIRMED'].includes(order.status)) throw new BadRequestException('Order cannot be paid');
    if (![...onlineMethods,...cashMethods].includes(provider)) throw new BadRequestException('Unsupported payment method');
    const payment=await this.prisma.payment.upsert({ where: { idempotencyKey }, update: {}, create: { orderId, provider, idempotencyKey, amount: order.total, currency: order.currency } });
    const mode=this.config.get('PAYMENT_PROVIDER','development');
    const online=onlineMethods.includes(provider);

    if (mode==='paynow' && online && payment.status==='PENDING') {
      const result=await this.paynow.initiateWebCheckout({
        reference: idempotencyKey,
        amount: Number(order.total),
        additionalInfo: `ZimMarket order #${order.id.slice(0,8)}`,
        authEmail: order.customer.email || this.config.get('PAYNOW_FALLBACK_EMAIL','payments@zimmarket.local'),
        returnUrl: `${this.config.getOrThrow('APP_PUBLIC_URL')}/orders/${order.id}`,
        resultUrl: `${this.config.getOrThrow('API_PUBLIC_URL')}/finance/webhooks/paynow`,
      });
      if (!result.success) throw new BadRequestException(result.error || 'Payment provider could not start this transaction');
      await this.prisma.payment.update({ where: { id: payment.id }, data: { providerCheckoutRef: result.pollUrl } });
      return {...payment,mode,online:true,checkoutUrl:result.browserUrl??null,requiresDemoConfirmation:false,instructions:'Continue with the secure Paynow checkout to complete your payment.'};
    }

    return {...payment,mode,online,checkoutUrl:null,requiresDemoConfirmation:mode==='development'&&online,instructions:cashMethods.includes(provider)?(provider==='CASH_ON_DELIVERY'?'Pay the authorized courier when your order arrives.':'Pay at the shop when collecting your order.'):'Continue with the selected secure payment provider.'};
  }
  async receipt(userId:string,accountType:string,paymentId:string){const payment=await this.prisma.payment.findUnique({where:{id:paymentId},include:{order:{include:{business:{select:{id:true,name:true}},customer:{select:{id:true,fullName:true,email:true,phone:true}},items:true,recipient:true,invoice:true}}}});if(!payment)throw new NotFoundException('Payment not found');const member=accountType===AccountType.BUSINESS&&await this.prisma.businessMember.findUnique({where:{userId_businessId:{userId,businessId:payment.order.businessId}}});if(payment.order.customerId!==userId&&!member&&accountType!==AccountType.ADMIN)throw new ForbiddenException('Receipt access denied');if(payment.status!=='SUCCEEDED')throw new BadRequestException('Receipt is available after payment confirmation');return{receiptNumber:`RCT-${payment.id.slice(0,8).toUpperCase()}`,invoiceNumber:payment.order.invoice?.number,paidAt:payment.updatedAt,provider:payment.provider,providerReference:payment.providerRef,amount:payment.amount,currency:payment.currency,order:{id:payment.order.id,status:payment.order.status,items:payment.order.items,recipient:payment.order.recipient},customer:payment.order.customer,business:payment.order.business}}
  async requestPayout(userId: string, businessId: string, amount: number, currency: string, destination: string) {
    const member = await this.prisma.businessMember.findUnique({ where: { userId_businessId: { userId, businessId } } });
    if (!member || !payoutRoles.includes(member.role)) throw new ForbiddenException('Finance permission required');
    const business=await this.prisma.business.findUnique({where:{id:businessId},include:{fiscalisation:true}});if(!business||business.status!=='ACTIVE'||!['COMPLIANT','EXPIRING_SOON'].includes(business.fiscalisation?.status||''))throw new ForbiddenException('Payouts are restricted while business compliance is incomplete or expired');
    return this.prisma.payout.create({ data: { businessId, amount: new Prisma.Decimal(amount), currency, destination } });
  }
  async webhook(signature: string, payload: { idempotencyKey: string; providerRef: string; status: 'SUCCEEDED'|'FAILED' }) {
    const expected = createHmac('sha256', this.config.getOrThrow('PAYMENT_WEBHOOK_SECRET')).update(JSON.stringify(payload)).digest('hex');
    const supplied = Buffer.from(signature); const calculated = Buffer.from(expected);
    if (supplied.length !== calculated.length || !timingSafeEqual(supplied, calculated)) throw new UnauthorizedException('Invalid webhook signature');
    return this.finalizePayment(payload.idempotencyKey, payload.providerRef, payload.status);
  }
  async paynowResultCallback(fields: Record<string,string>) {
    const result = this.paynow.verifyResultCallback(fields);
    if (!result.success) throw new UnauthorizedException(result.error || 'Invalid Paynow callback');
    if (!result.reference) throw new BadRequestException('Missing payment reference');
    if (!result.paid && !result.failed) return { received: true, status: result.status };
    return this.finalizePayment(result.reference, result.paynowReference || result.reference, result.paid ? 'SUCCEEDED' : 'FAILED');
  }
  async pollPaymentStatus(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, order: { customerId: userId } } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'PENDING' || !payment.providerCheckoutRef) return payment;
    const result = await this.paynow.pollStatus(payment.providerCheckoutRef);
    if (!result.success || (!result.paid && !result.failed)) return payment;
    return this.finalizePayment(payment.idempotencyKey, result.paynowReference || payment.providerRef || payment.idempotencyKey, result.paid ? 'SUCCEEDED' : 'FAILED');
  }
  private async finalizePayment(idempotencyKey: string, providerRef: string, status: 'SUCCEEDED'|'FAILED') {
    const payment = await this.prisma.payment.findUnique({ where: { idempotencyKey }, include: { order: {include:{invoice:true,customer:true,items:true,recipient:true,business:true}} } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'SUCCEEDED') return payment;
    const payload = { idempotencyKey, providerRef, status };
    return this.prisma.$transaction(async tx => {
      const updated = await tx.payment.update({ where: { id: payment.id }, data: { providerRef: payload.providerRef, status: payload.status } });
      if (payload.status === 'SUCCEEDED') {
        await tx.order.update({ where: { id: payment.orderId }, data: { status: 'PAID' } });
        const receipt={receiptNumber:`RCT-${payment.id.slice(0,8).toUpperCase()}`,paymentId:payment.id,provider:payment.provider,providerReference:payload.providerRef,paidAt:new Date().toISOString(),amount:payment.amount.toString(),currency:payment.currency,business:{id:payment.order.business.id,name:payment.order.business.name},customer:{id:payment.order.customer.id,name:payment.order.customer.fullName},items:payment.order.items.map(item=>({name:item.productName,quantity:item.quantity,unitPrice:item.unitPrice.toString()})),recipient:payment.order.recipient};
        if(payment.order.invoice)await tx.invoice.update({where:{id:payment.order.invoice.id},data:{type:'PAYMENT_RECEIPT',snapshot:receipt}});
        const recipient=payment.order.customer.email||payment.order.customer.phone;if(recipient)await tx.notificationOutbox.create({data:{channel:payment.order.customer.email?'EMAIL':'SMS',recipient,template:'PAYMENT_RECEIPT',payload:receipt}});
        await tx.ledgerEntry.createMany({ data: [
          { paymentId: payment.id, businessId: payment.order.businessId, account: 'provider_clearing', direction: 'DEBIT', amount: payment.amount, currency: payment.currency, description: 'Customer payment received' },
          { paymentId: payment.id, businessId: payment.order.businessId, account: 'business_payable', direction: 'CREDIT', amount: payment.amount, currency: payment.currency, description: 'Business proceeds payable' },
        ] });
      }
      return updated;
    });
  }
  async requestRefund(userId:string,orderId:string,amount:number,reason:string){const order=await this.prisma.order.findFirst({where:{id:orderId,customerId:userId,status:{in:['PAID','PROCESSING','SHIPPED','DELIVERED']}},include:{payments:{where:{status:'SUCCEEDED'}}}});if(!order||!order.payments.length)throw new BadRequestException('Order is not refundable');if(new Prisma.Decimal(amount).gt(order.total))throw new BadRequestException('Refund exceeds order total');return this.prisma.refundRequest.create({data:{orderId,businessId:order.businessId,requesterId:userId,amount,currency:order.currency,reason}})}
  async reviewRefund(userId:string,businessId:string,id:string,approve:boolean){const member=await this.prisma.businessMember.findUnique({where:{userId_businessId:{userId,businessId}}});const roles:BusinessRole[]=[BusinessRole.OWNER,BusinessRole.FINANCE];if(!member||!roles.includes(member.role))throw new ForbiddenException('Finance permission required');const refund=await this.prisma.refundRequest.findFirst({where:{id,businessId,status:'REQUESTED'}});if(!refund)throw new NotFoundException('Refund request not found');return this.prisma.refundRequest.update({where:{id},data:{status:approve?'APPROVED':'REJECTED',reviewedById:userId}})}
  async completeRefund(signature:string,payload:{refundId:string;providerRef:string}){const expected=createHmac('sha256',this.config.getOrThrow('PAYMENT_WEBHOOK_SECRET')).update(JSON.stringify(payload)).digest('hex');const a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))throw new UnauthorizedException('Invalid webhook signature');const refund=await this.prisma.refundRequest.findFirst({where:{id:payload.refundId,status:{in:['APPROVED','PROCESSING']}},include:{order:{include:{payments:{where:{status:'SUCCEEDED'},take:1}}}}});if(!refund||!refund.order.payments[0])throw new NotFoundException('Refund not found');const payment=refund.order.payments[0];return this.prisma.$transaction(async tx=>{await tx.refundRequest.update({where:{id:refund.id},data:{status:'REFUNDED'}});await tx.payment.update({where:{id:payment.id},data:{status:'REFUNDED'}});await tx.order.update({where:{id:refund.orderId},data:{status:'REFUNDED'}});await tx.ledgerEntry.createMany({data:[{paymentId:payment.id,businessId:refund.businessId,account:'business_payable',direction:'DEBIT',amount:refund.amount,currency:payment.currency,description:'Refund reversal'},{paymentId:payment.id,businessId:refund.businessId,account:'provider_clearing',direction:'CREDIT',amount:refund.amount,currency:payment.currency,description:'Customer refund payable'}]});return{refunded:true,providerRef:payload.providerRef}})}
  async demoCompletePayment(userId:string,paymentId:string,status:'SUCCEEDED'|'FAILED'){this.demoOnly();const payment=await this.prisma.payment.findFirst({where:{id:paymentId,order:{customerId:userId}}});if(!payment)throw new NotFoundException('Payment not found');const payload={idempotencyKey:payment.idempotencyKey,providerRef:`demo-${crypto.randomUUID()}`,status};const signature=createHmac('sha256',this.config.getOrThrow('PAYMENT_WEBHOOK_SECRET')).update(JSON.stringify(payload)).digest('hex');return this.webhook(signature,payload)}
  async demoCompleteRefund(userId:string,refundId:string){this.demoOnly();const refund=await this.prisma.refundRequest.findFirst({where:{id:refundId,requesterId:userId,status:'APPROVED'}});if(!refund)throw new NotFoundException('Approved refund not found');const payload={refundId,providerRef:`demo-refund-${crypto.randomUUID()}`};const signature=createHmac('sha256',this.config.getOrThrow('PAYMENT_WEBHOOK_SECRET')).update(JSON.stringify(payload)).digest('hex');return this.completeRefund(signature,payload)}
  private demoOnly(){if(this.config.get('NODE_ENV')==='production')throw new ForbiddenException('Demo providers are disabled in production')}
}
