import { BadRequestException } from '@nestjs/common';
import { PrivacyService } from './privacy.service';

describe('PrivacyService account deletion', () => {
  it('refuses to delete an account with an order still in progress', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const withContext = jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn({ order: { count } }));
    const service = new PrivacyService({ withContext } as never);

    await expect(service.remove('user-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(withContext).toHaveBeenCalledTimes(1);
  });

  it('revokes sessions and scrubs identifying fields once orders are clear', async () => {
    const tx = { order: { count: jest.fn().mockResolvedValue(0) }, session: { updateMany: jest.fn() }, user: { update: jest.fn() }, auditLog: { create: jest.fn() } };
    const withContext = jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn(tx));
    const service = new PrivacyService({ withContext } as never);

    const result = await service.remove('user-a');

    expect(result).toEqual({ deleted: true });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'user-a' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) });
  });

  it('exports the user record along with related orders, memberships and messages', async () => {
    const findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'user-a' });
    const withContext = jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn({ user: { findUniqueOrThrow } }));
    const service = new PrivacyService({ withContext } as never);

    const result = await service.export('user-a');

    expect(findUniqueOrThrow.mock.calls[0][0].select).toMatchObject({ orders: expect.anything(), memberships: expect.anything(), messages: true });
    expect(result.user).toEqual({ id: 'user-a' });
  });
});
