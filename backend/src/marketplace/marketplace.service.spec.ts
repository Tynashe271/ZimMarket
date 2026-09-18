import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService', () => {
  it('blocks staff without a marketing-eligible role from creating an advertisement', async () => {
    const require = jest.fn();
    const findUnique = jest.fn().mockResolvedValue({ role: 'SALES' });
    const service = new MarketplaceService({ businessMember: { findUnique } } as never, {} as never, { require } as never, {} as never, {} as never);

    await expect(service.createAd('staff', 'business-a', 'product-a', 'Sale')).rejects.toBeInstanceOf(ForbiddenException);
    expect(require).not.toHaveBeenCalled();
  });

  it('refuses to advertise while business compliance is incomplete', async () => {
    const prisma = {
      businessMember: { findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }) },
      business: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE', fiscalisation: { status: 'CHANGES_REQUIRED' } }) },
    };
    const service = new MarketplaceService(prisma as never, {} as never, { require: jest.fn() } as never, {} as never, {} as never);

    await expect(service.createAd('owner', 'business-a', 'product-a', 'Sale')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a non-customer account from opening a storefront conversation', async () => {
    const service = new MarketplaceService({} as never, {} as never, {} as never, {} as never, {} as never);
    await expect(service.openConversation('user-a', AccountType.BUSINESS, 'business-a')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes conversations to escalated threads for administrators', () => {
    const findMany = jest.fn();
    const withContext = jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn({ conversation: { findMany } }));
    const service = new MarketplaceService({ withContext } as never, {} as never, {} as never, {} as never, {} as never);

    service.conversations('admin-1', AccountType.ADMIN);

    expect(findMany.mock.calls[0][0].where).toEqual({ escalatedAt: { not: null } });
  });

  it('rejects an empty message after trimming whitespace', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'conversation-a' });
    const service = new MarketplaceService({ conversation: { findFirst } } as never, {} as never, {} as never, {} as never, {} as never);

    await expect(service.sendMessage('user-a', AccountType.CUSTOMER, 'conversation-a', '   ')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('notifies every business member (not the sender) when a customer sends a message', async () => {
    const tx = { message: { create: jest.fn().mockResolvedValue({ id: 'message-a' }) }, conversation: { update: jest.fn() } };
    const prisma = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conversation-a', customerId: 'user-a', businessId: 'business-a' }) },
      businessMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'staff-1' }, { userId: 'staff-2' }]) },
      withContext: jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn(tx)),
    };
    const newMessage = jest.fn();
    const service = new MarketplaceService(prisma as never, {} as never, {} as never, {} as never, { newMessage } as never);

    await service.sendMessage('user-a', AccountType.CUSTOMER, 'conversation-a', 'Hello there');

    expect(newMessage).toHaveBeenCalledTimes(2);
    expect(newMessage).toHaveBeenCalledWith('staff-1', 'conversation-a');
    expect(newMessage).toHaveBeenCalledWith('staff-2', 'conversation-a');
  });

  it('notifies only the customer (not the sender) when business staff sends a message', async () => {
    const tx = { message: { create: jest.fn().mockResolvedValue({ id: 'message-a' }) }, conversation: { update: jest.fn() } };
    const prisma = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conversation-a', customerId: 'customer-a', businessId: 'business-a' }) },
      businessMember: { findMany: jest.fn() },
      withContext: jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn(tx)),
    };
    const newMessage = jest.fn();
    const service = new MarketplaceService(prisma as never, {} as never, {} as never, {} as never, { newMessage } as never);

    await service.sendMessage('staff-1', AccountType.BUSINESS, 'conversation-a', 'We can help with that');

    expect(prisma.businessMember.findMany).not.toHaveBeenCalled();
    expect(newMessage).toHaveBeenCalledTimes(1);
    expect(newMessage).toHaveBeenCalledWith('customer-a', 'conversation-a');
  });

  it('refuses to let one customer delete another customer\'s message', async () => {
    const tx = { message: { findFirst: jest.fn().mockResolvedValue({ id: 'message-a', senderId: 'other-user' }), update: jest.fn() } };
    const prisma = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conversation-a' }) },
      withContext: jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn(tx)),
    };
    const service = new MarketplaceService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(service.deleteMessage('user-a', AccountType.CUSTOMER, 'conversation-a', 'message-a')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.message.update).not.toHaveBeenCalled();
  });

  it('rejects a document upload that fails the malware scan', async () => {
    const create = jest.fn();
    const providers = { scan: jest.fn().mockResolvedValue({ clean: false }) };
    const service = new MarketplaceService({ document: { create } } as never, {} as never, {} as never, providers as never, {} as never);

    await expect(service.createDocument('user-a', undefined, { type: 'ID', storageKey: 'user-a/id.png', mimeType: 'image/png', sizeBytes: 100 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an ad for a product that does not belong to the business', async () => {
    const prisma = {
      businessMember: { findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }) },
      business: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE', fiscalisation: { status: 'COMPLIANT' } }) },
      product: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new MarketplaceService(prisma as never, {} as never, { require: jest.fn() } as never, {} as never, {} as never);

    await expect(service.createAd('owner', 'business-a', 'missing-product', 'Sale')).rejects.toBeInstanceOf(NotFoundException);
  });
});
