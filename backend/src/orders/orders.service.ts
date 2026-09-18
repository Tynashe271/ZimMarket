import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FraudService } from '../security/fraud.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService, private readonly fraud: FraudService) {}
  async create(customerId: string, accountType: string, items: { productId: string; quantity: number }[], branchId?: string, recipient?: { name: string; phone: string; address: string; city: string }) {
    if (accountType !== AccountType.CUSTOMER) throw new ForbiddenException('Customer account required');
    if (!items.length) throw new BadRequestException('Order requires at least one item');
    return this.prisma.withContext({ userId: customerId, accountType }, async (tx) => {
      const products=await tx.product.findMany({where:{id:{in:items.map(i=>i.productId)},status:'ACTIVE',business:{status:'ACTIVE',fiscalisation:{is:{status:{in:['COMPLIANT','EXPIRING_SOON']},taxpayerActive:true,deviceActive:true,deviceRegistered:true,receiptVerifiedAt:{not:null},taxClearanceExpiresAt:{gt:new Date()}}}}}});
      if (products.length !== items.length) throw new BadRequestException('One or more products are unavailable');
      const businessIds = new Set(products.map(p => p.businessId));
      if (businessIds.size !== 1) throw new BadRequestException('An order can only contain products from one business');
      let total = new Prisma.Decimal(0);
      const snapshots = items.map(item => {
        const product = products.find(p => p.id === item.productId)!;
        if (item.quantity < 1 || product.stockQuantity < item.quantity) throw new BadRequestException(`Insufficient stock for ${product.name}`);
        total = total.add(product.price.mul(item.quantity));
        return { productId: product.id, productName: product.name, unitPrice: product.price, quantity: item.quantity };
      });
      if (branchId) {
        for (const item of items) {
          const inventory = await tx.branchInventory.findUnique({ where: { branchId_productId: { branchId, productId: item.productId } } });
          if (!inventory || inventory.quantity - inventory.reserved < item.quantity) throw new BadRequestException('Insufficient stock at selected branch');
          const remaining = inventory.quantity - item.quantity;
          await tx.branchInventory.update({ where: { id: inventory.id }, data: { quantity: remaining, availability: remaining <= 0 ? 'UNAVAILABLE' : remaining <= inventory.lowStockAt ? 'LOW_STOCK' : 'AVAILABLE' } });
        }
      }
      const order = await tx.order.create({ data: { customerId, businessId: [...businessIds][0], branchId, total, items: { create: snapshots } }, include: { items: true } });
      await Promise.all(items.map(i => tx.product.update({ where: { id: i.productId }, data: { stockQuantity: { decrement: i.quantity } } })));
      if (recipient) await tx.recipient.create({ data: { ...recipient, orderId: order.id, buyerId: customerId } });
      await tx.invoice.create({ data: { orderId: order.id, number: `INV-${order.id.slice(0, 8).toUpperCase()}`, type: 'ORDER_CONFIRMATION', snapshot: { total: total.toString(), currency: order.currency, items: snapshots.map(i => ({ ...i, unitPrice: i.unitPrice.toString() })), recipient } } });
      await this.fraud.evaluateOrder(customerId, order.businessId, total);
      return order;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  listCustomer(customerId: string) { return this.prisma.withContext({ userId: customerId }, tx => tx.order.findMany({ where: { customerId }, include: { items: true, payments: true, business: { select: { name: true, slug: true } }, recipient: true, delivery: true, review: true, dispute: true, refundRequests: true, invoice: true }, orderBy: { createdAt: 'desc' } })); }
  async listBusiness(userId: string, businessId: string) {
    const member = await this.prisma.businessMember.findUnique({ where: { userId_businessId: { userId, businessId } } });
    if (!member) throw new NotFoundException('Business not found');
    return this.prisma.withContext({ userId }, tx => tx.order.findMany({ where: { businessId }, include: { items: true, payments: true, recipient:true, delivery:true, invoice:true, customer:{select:{id:true,fullName:true,phone:true,email:true}} }, orderBy: { createdAt: 'desc' } }));
  }
  async transition(userId: string, businessId: string, orderId: string, next: OrderStatus) {
    const member = await this.prisma.businessMember.findUnique({ where: { userId_businessId: { userId, businessId } } });
    if (!member) throw new NotFoundException('Business not found');
    return this.prisma.withContext({ userId }, async tx => {
      const order = await tx.order.findFirst({ where: { id: orderId, businessId } });
      if (!order) throw new NotFoundException('Order not found');
      const allowed: Partial<Record<OrderStatus, OrderStatus[]>> = { PENDING: ['CONFIRMED','CANCELLED'], CONFIRMED: ['PROCESSING','CANCELLED'], PAID: ['PROCESSING','REFUNDED'], PROCESSING: ['SHIPPED','CANCELLED'], SHIPPED: ['DELIVERED'] };
      if (!allowed[order.status]?.includes(next)) throw new BadRequestException(`Invalid transition from ${order.status} to ${next}`);
      const updated=await tx.order.update({ where: { id: order.id }, data: { status: next } });
      if(next==='DELIVERED'){
        const programs=await tx.loyaltyProgram.findMany({where:{businessId,active:true}});
        for(const program of programs)await tx.loyaltyAccount.upsert({where:{programId_customerId:{programId:program.id,customerId:order.customerId}},create:{programId:program.id,customerId:order.customerId,points:Math.floor(Number(order.total)*program.pointsPerDollar)},update:{points:{increment:Math.floor(Number(order.total)*program.pointsPerDollar)}}});
      }
      return updated;
    });
  }
}
