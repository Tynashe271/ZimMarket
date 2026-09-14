import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
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
