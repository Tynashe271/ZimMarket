import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

function makeContext(user: { accountType: string } | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows the request through when the route declares no roles', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new RolesGuard(reflector as never);

    expect(guard.canActivate(makeContext({ accountType: 'CUSTOMER' }))).toBe(true);
  });

  it('allows a user whose accountType matches a required role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) };
    const guard = new RolesGuard(reflector as never);

    expect(guard.canActivate(makeContext({ accountType: 'ADMIN' }))).toBe(true);
  });

  it('rejects a user whose accountType does not match a required role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) };
    const guard = new RolesGuard(reflector as never);

    expect(() => guard.canActivate(makeContext({ accountType: 'CUSTOMER' }))).toThrow('Insufficient permissions');
  });

  it('rejects when there is no authenticated user at all', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) };
    const guard = new RolesGuard(reflector as never);

    expect(() => guard.canActivate(makeContext(undefined))).toThrow('Insufficient permissions');
  });
});
