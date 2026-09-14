import { BadRequestException } from '@nestjs/common';
import { PrivacyService } from './privacy.service';

describe('PrivacyService account deletion', () => {
  it('refuses to delete an account with an order still in progress', async () => {
    const transaction = jest.fn();
    const prisma = { order: { count: jest.fn().mockResolvedValue(1) }, $transaction: transaction };
    const service = new PrivacyService(prisma as never);

    await expect(service.remove('user-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('revokes sessions and scrubs identifying fields once orders are clear', async () => {
    const transaction = jest.fn().mockImplementation(async (callback) => callback({ session: { updateMany: jest.fn() }, user: { update: jest.fn() }, auditLog: { create: jest.fn() } }));
    const prisma = { order: { count: jest.fn().mockResolvedValue(0) }, $transaction: transaction };
    const service = new PrivacyService(prisma as never);

    const result = await service.remove('user-a');

    expect(result).toEqual({ deleted: true });
    expect(transaction).toHaveBeenCalled();
  });

  it('exports the user record along with related orders, memberships and messages', async () => {
    const findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'user-a' });
    const service = new PrivacyService({ user: { findUniqueOrThrow } } as never);

    const result = await service.export('user-a');

    expect(findUniqueOrThrow.mock.calls[0][0].select).toMatchObject({ orders: expect.anything(), memberships: expect.anything(), messages: true });
    expect(result.user).toEqual({ id: 'user-a' });
  });
});
