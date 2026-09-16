import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

describe('AuthService account safety', () => {
  it('rejects admin self-registration before touching the database', async () => {
    const create = jest.fn();
    const prisma = { user: { create } } as never;
    const service = new AuthService(prisma, {} as never, {} as never, {} as never, {} as never);
    await expect(service.register({ accountType: AccountType.ADMIN, phone: '+263771234567', password: 'password123' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('locks the account and raises a fraud signal after five failed logins', async () => {
    const update = jest.fn();
    const signal = jest.fn();
    const passwordHash = await argon2.hash('correct-password');
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-a', passwordHash, failedLoginCount: 4, lockedUntil: null, accountType: AccountType.CUSTOMER }),
        update,
      },
    } as never;
    const service = new AuthService(prisma, {} as never, {} as never, {} as never, { signal } as never);

    await expect(service.login({ identifier: 'user@zim.co.zw', password: 'wrong-password' })).rejects.toBeInstanceOf(UnauthorizedException);

    expect(update).toHaveBeenCalledWith({ where: { id: 'user-a' }, data: { failedLoginCount: 5, lockedUntil: expect.any(Date) } });
    expect(signal).toHaveBeenCalledWith('user-a', undefined, 'LOGIN_BRUTE_FORCE', 'HIGH', 80, { attempts: 5 });
  });

  it('rejects an already-locked account without a fresh fraud signal', async () => {
    const signal = jest.fn();
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-a', lockedUntil: new Date(Date.now() + 60_000) }), update: jest.fn() } } as never;
    const service = new AuthService(prisma, {} as never, {} as never, {} as never, { signal } as never);

    await expect(service.login({ identifier: 'user@zim.co.zw', password: 'anything' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signal).not.toHaveBeenCalled();
  });

  it('rejects a non-admin account on the administrator sign-in portal', async () => {
    const passwordHash = await argon2.hash('correct-password');
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-a', passwordHash, failedLoginCount: 0, lockedUntil: null, accountType: AccountType.CUSTOMER }),
        update: jest.fn(),
      },
    } as never;
    const service = new AuthService(prisma, {} as never, {} as never, {} as never, {} as never);

    await expect(service.adminLogin({ identifier: 'user@zim.co.zw', password: 'correct-password' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService password reset', () => {
  it('queues a reset code for a known identifier without leaking whether it exists', async () => {
    const tokenCreate = jest.fn();
    const verification = jest.fn();
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-a' }) }, verificationToken: { create: tokenCreate } } as never;
    const config = { get: jest.fn().mockReturnValue(undefined) } as never;
    const service = new AuthService(prisma, {} as never, config, { verification } as never, {} as never);

    const result = await service.requestPasswordReset('user@zim.co.zw');

    expect(tokenCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-a', type: 'PASSWORD_RESET' }) }));
    expect(verification).toHaveBeenCalledWith('user-a', 'PASSWORD_RESET', expect.any(String));
    expect(result).toEqual({ accepted: true });
  });

  it('reports acceptance for an unknown identifier without creating a token', async () => {
    const tokenCreate = jest.fn();
    const verification = jest.fn();
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) }, verificationToken: { create: tokenCreate } } as never;
    const service = new AuthService(prisma, {} as never, { get: jest.fn() } as never, { verification } as never, {} as never);

    const result = await service.requestPasswordReset('nobody@zim.co.zw');

    expect(tokenCreate).not.toHaveBeenCalled();
    expect(verification).not.toHaveBeenCalled();
    expect(result).toEqual({ accepted: true });
  });

  it('resets the password and revokes sessions when the code is valid', async () => {
    const code = '123456';
    const tokenUpdate = jest.fn();
    const userUpdate = jest.fn();
    const sessionUpdateMany = jest.fn();
    const transaction = jest.fn(actions => Promise.all(actions));
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-a' }), update: userUpdate },
      verificationToken: { findMany: jest.fn().mockResolvedValue([{ id: 'token-a', tokenHash: await argon2.hash(code) }]), update: tokenUpdate },
      session: { updateMany: sessionUpdateMany },
      $transaction: transaction,
    } as never;
    const service = new AuthService(prisma, {} as never, {} as never, {} as never, {} as never);

    const result = await service.confirmPasswordReset('user@zim.co.zw', code, 'brand-new-password');

    expect(tokenUpdate).toHaveBeenCalledWith({ where: { id: 'token-a' }, data: { usedAt: expect.any(Date) } });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-a' }, data: expect.objectContaining({ passwordHash: expect.any(String), failedLoginCount: 0, lockedUntil: null }) });
    expect(sessionUpdateMany).toHaveBeenCalledWith({ where: { userId: 'user-a', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(result).toEqual({ reset: true });
  });

  it('rejects an incorrect reset code', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-a' }) },
      verificationToken: { findMany: jest.fn().mockResolvedValue([{ id: 'token-a', tokenHash: await argon2.hash('654321') }]) },
    } as never;
    const service = new AuthService(prisma, {} as never, {} as never, {} as never, {} as never);

    await expect(service.confirmPasswordReset('user@zim.co.zw', '123456', 'brand-new-password')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a reset attempt for an unknown identifier', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } } as never;
    const service = new AuthService(prisma, {} as never, {} as never, {} as never, {} as never);

    await expect(service.confirmPasswordReset('nobody@zim.co.zw', '123456', 'brand-new-password')).rejects.toBeInstanceOf(BadRequestException);
  });
});
