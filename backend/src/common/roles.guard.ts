import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountType } from '@prisma/client';
import { AuthUser } from '../auth/jwt.strategy';
import { ROLES_KEY } from './roles.decorator';

// Route-level enforcement for @Roles(...): rejects before the handler (and its
// service) ever runs, instead of relying on every service method to remember to
// check accountType itself. Run after JwtAuthGuard so request.user is populated.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AccountType[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || !roles.includes(user.accountType as AccountType)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
