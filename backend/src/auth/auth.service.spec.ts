import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

// RLS-context-aware Prisma calls go through withContext()/withSystemContext()
// rather than the raw model delegates directly. This fake runs the callback
// against the same fake `tx`-shaped object the test configures, so the
// existing assertions on e.g. `tx.user.update` still work unchanged.
function makePrisma(overrides: Record<string, unknown> = {}) {
  const tx = overrides;
  return {
    ...overrides,
    withContext: jest.fn((_context: unknown, fn: (tx: unknown) => unknown) => fn(tx)),
    withSystemContext: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
  };
}

describe('AuthService account safety', () => {
  it('rejects admin self-registration before touching the database', async () => {
    const create = jest.fn();
    const prisma = makePrisma({ user: { create } });
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    await expect(service.register({ accountType: AccountType.ADMIN, phone: '+263771234567', password: 'password123' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('locks the account and raises a fraud signal after five failed logins', async () => {
    const update = jest.fn();
    const signal = jest.fn();
    const passwordHash = await argon2.hash('correct-password');
    const prisma = makePrisma({
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-a', passwordHash, failedLoginCount: 4, lockedUntil: null, accountType: AccountType.CUSTOMER }),
        update,
      },
    });
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, { signal } as never);

    await expect(service.login({ identifier: 'user@zim.co.zw', password: 'wrong-password' })).rejects.toBeInstanceOf(UnauthorizedException);

    expect(update).toHaveBeenCalledWith({ where: { id: 'user-a' }, data: { failedLoginCount: 5, lockedUntil: expect.any(Date) } });
    expect(signal).toHaveBeenCalledWith('user-a', undefined, 'LOGIN_BRUTE_FORCE', 'HIGH', 80, { attempts: 5 });
  });

  it('rejects an already-locked account without a fresh fraud signal', async () => {
    const signal = jest.fn();
    const prisma = makePrisma({ user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-a', lockedUntil: new Date(Date.now() + 60_000) }), update: jest.fn() } });
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, { signal } as never);

    await expect(service.login({ identifier: 'user@zim.co.zw', password: 'anything' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signal).not.toHaveBeenCalled();
  });

  it('rejects a non-admin account on the administrator sign-in portal', async () => {
    const passwordHash = await argon2.hash('correct-password');
    const prisma = makePrisma({
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-a', passwordHash, failedLoginCount: 0, lockedUntil: null, accountType: AccountType.CUSTOMER }),
        update: jest.fn(),
      },
    });
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(service.adminLogin({ identifier: 'user@zim.co.zw', password: 'correct-password' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService password reset', () => {
  it('queues a reset code for a known identifier without leaking whether it exists', async () => {
    const tokenCreate = jest.fn();
    const verification = jest.fn();
    const prisma = makePrisma({ user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-a' }) }, verificationToken: { create: tokenCreate } });
    const config = { get: jest.fn().mockReturnValue(undefined) } as never;
    const service = new AuthService(prisma as never, {} as never, config, { verification } as never, {} as never);

    const result = await service.requestPasswordReset('user@zim.co.zw');

    expect(tokenCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-a', type: 'PASSWORD_RESET' }) }));
    expect(verification).toHaveBeenCalledWith('user-a', 'PASSWORD_RESET', expect.any(String));
    expect(result).toEqual({ accepted: true });
  });

  it('reports acceptance for an unknown identifier without creating a token', async () => {
    const tokenCreate = jest.fn();
    const verification = jest.fn();
    const prisma = makePrisma({ user: { findFirst: jest.fn().mockResolvedValue(null) }, verificationToken: { create: tokenCreate } });
    const service = new AuthService(prisma as never, {} as never, { get: jest.fn() } as never, { verification } as never, {} as never);

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
    const prisma = makePrisma({
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-a' }), update: userUpdate },
      verificationToken: { findMany: jest.fn().mockResolvedValue([{ id: 'token-a', tokenHash: await argon2.hash(code) }]), update: tokenUpdate },
      session: { updateMany: sessionUpdateMany },
    });
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const result = await service.confirmPasswordReset('user@zim.co.zw', code, 'brand-new-password');

    expect(tokenUpdate).toHaveBeenCalledWith({ where: { id: 'token-a' }, data: { usedAt: expect.any(Date) } });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-a' }, data: expect.objectContaining({ passwordHash: expect.any(String), failedLoginCount: 0, lockedUntil: null }) });
    expect(sessionUpdateMany).toHaveBeenCalledWith({ where: { userId: 'user-a', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(result).toEqual({ reset: true });
  });

  it('rejects an incorrect reset code and raises a fraud signal', async () => {
    const verificationFailure = jest.fn();
    const prisma = makePrisma({
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-a' }) },
      verificationToken: { findMany: jest.fn().mockResolvedValue([{ id: 'token-a', tokenHash: await argon2.hash('654321') }]) },
    });
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, { verificationFailure } as never);

    await expect(service.confirmPasswordReset('user@zim.co.zw', '123456', 'brand-new-password')).rejects.toBeInstanceOf(BadRequestException);
    expect(verificationFailure).toHaveBeenCalledWith('user-a', 'PASSWORD_RESET');
  });

  it('rejects a reset attempt for an unknown identifier', async () => {
    const prisma = makePrisma({ user: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(service.confirmPasswordReset('nobody@zim.co.zw', '123456', 'brand-new-password')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AuthService verification codes', () => {
  it('marks the account verified when the code matches an active token', async () => {
    const code = '123456';
    const tokenUpdate = jest.fn();
    const userUpdate = jest.fn();
    const prisma = makePrisma({
      verificationToken: { findMany: jest.fn().mockResolvedValue([{ id: 'token-a', tokenHash: await argon2.hash(code) }]), update: tokenUpdate },
      user: { update: userUpdate },
    });
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const result = await service.verify('user-a', 'PHONE', code);

    expect(tokenUpdate).toHaveBeenCalledWith({ where: { id: 'token-a' }, data: { usedAt: expect.any(Date) } });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-a' }, data: { phoneVerifiedAt: expect.any(Date) } });
    expect(result).toEqual({ verified: true });
  });

  it('rejects an incorrect verification code and raises a fraud signal', async () => {
    const verificationFailure = jest.fn();
    const prisma = makePrisma({ verificationToken: { findMany: jest.fn().mockResolvedValue([{ id: 'token-a', tokenHash: await argon2.hash('654321') }]) } });
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, { verificationFailure } as never);

    await expect(service.verify('user-a', 'PHONE', '123456')).rejects.toBeInstanceOf(BadRequestException);
    expect(verificationFailure).toHaveBeenCalledWith('user-a', 'PHONE');
  });
});
