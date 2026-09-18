import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccountType, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { JobsService } from '../jobs/jobs.service';
import { FraudService } from '../security/fraud.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../common/phone';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService, private readonly jobs: JobsService, private readonly fraud: FraudService) {}

  async register(dto: RegisterDto) {
    try {
      if (dto.accountType === AccountType.ADMIN) throw new ForbiddenException('Administrator accounts cannot be self-registered');
      if (dto.accountType === AccountType.CUSTOMER && (!dto.fullName || !dto.city || !dto.acceptedPolicies)) throw new BadRequestException('Customer name, city and policy acceptance are required');
      const { password, acceptedPolicies, deliveryAddress, ...profile } = dto;
      const passwordHash = await argon2.hash(password);
      const user = await this.prisma.withSystemContext(tx => tx.user.create({
        data: { ...profile, email: dto.email?.toLowerCase(), passwordHash, ...(deliveryAddress ? { deliveryAddresses: [deliveryAddress] } : {}), ...(acceptedPolicies ? { policyVersion: '2026-09-18', policyAcceptedAt: new Date() } : {}) },
        select: { id: true, email: true, phone: true, accountType: true, fullName: true, city: true, province: true, suburb: true, deliveryAddresses: true, notificationPreference: true, emailVerifiedAt: true, phoneVerifiedAt: true, policyVersion: true, policyAcceptedAt: true, createdAt: true },
      }));
      return { user, ...(await this.createSession(user)) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email or phone is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, requiredAccountType?: AccountType) {
    const user = await this.prisma.withSystemContext(tx => tx.user.findFirst({
      where: dto.identifier.includes('@')
        ? { email: dto.identifier.toLowerCase() }
        : { phone: normalizePhone(dto.identifier) as string },
    }));
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new UnauthorizedException('Account temporarily locked');
    if (!(await argon2.verify(user.passwordHash, dto.password))) {
      const attempts = user.failedLoginCount + 1;
      await this.prisma.withSystemContext(tx => tx.user.update({ where: { id: user.id }, data: { failedLoginCount: attempts, lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null } }));
      if (attempts >= 5) await this.fraud.signal(user.id, undefined, 'LOGIN_BRUTE_FORCE', 'HIGH', 80, { attempts });
      throw new UnauthorizedException('Invalid credentials');
    }
    if (requiredAccountType && user.accountType !== requiredAccountType) throw new UnauthorizedException('Administrator credentials required');
    if (!requiredAccountType && user.accountType === AccountType.ADMIN) throw new UnauthorizedException('Use the administrator sign-in portal');
    await this.prisma.withSystemContext(tx => tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } }));
    return {
      user: { id: user.id, email: user.email, phone: user.phone, accountType: user.accountType, fullName: user.fullName, city: user.city, province: user.province, suburb: user.suburb, deliveryAddresses: user.deliveryAddresses, notificationPreference: user.notificationPreference, emailVerifiedAt: user.emailVerifiedAt, phoneVerifiedAt: user.phoneVerifiedAt, policyVersion: user.policyVersion, policyAcceptedAt: user.policyAcceptedAt },
      ...(await this.createSession(user)),
    };
  }

  adminLogin(dto: LoginDto) { return this.login(dto, AccountType.ADMIN); }

  async refresh(refreshToken: string) {
    let payload: { sub: string; sid: string; accountType: string };
    try { payload = await this.jwt.verifyAsync(refreshToken, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET') }); }
    catch { throw new UnauthorizedException('Invalid refresh token'); }
    const session = await this.prisma.withSystemContext(tx => tx.session.findFirst({ where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } }));
    if (!session || !(await argon2.verify(session.refreshTokenHash, refreshToken))) throw new UnauthorizedException('Invalid refresh token');
    return this.rotateSession(session.id, session.user);
  }

  async revoke(userId: string, sessionId: string) {
    await this.prisma.session.updateMany({ where: { id: sessionId, userId }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  sessions(userId: string) { return this.prisma.session.findMany({ where: { userId, revokedAt: null }, select: { id: true, deviceName: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true } }); }
  profile(userId: string) { return this.prisma.withContext({ userId }, tx => tx.user.findUnique({ where: { id: userId }, select: { id:true,email:true,phone:true,accountType:true,fullName:true,province:true,city:true,suburb:true,deliveryAddresses:true,notificationPreference:true,emailVerifiedAt:true,phoneVerifiedAt:true,mfaEnabled:true,policyVersion:true,policyAcceptedAt:true,createdAt:true } })); }
  updateProfile(userId: string, dto: { fullName?:string;province?:string;city?:string;suburb?:string;notificationPreference?:string;deliveryAddress?:object }) { return this.prisma.withContext({ userId }, async tx => { const {deliveryAddress,...data}=dto; const current=deliveryAddress?await tx.user.findUnique({where:{id:userId},select:{deliveryAddresses:true}}):null; const addresses=Array.isArray(current?.deliveryAddresses)?current.deliveryAddresses:[]; return tx.user.update({where:{id:userId},data:{...data,...(deliveryAddress?{deliveryAddresses:[...addresses,deliveryAddress]}:{})},select:{id:true,fullName:true,province:true,city:true,suburb:true,deliveryAddresses:true,notificationPreference:true}}); }); }

  async requestVerification(userId: string, type: 'EMAIL'|'PHONE'|'PASSWORD_RESET'|'MFA') {
    const code = randomInt(100000, 1000000).toString();
    await this.prisma.verificationToken.create({ data: { userId, type, tokenHash: await argon2.hash(code), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    await this.jobs.verification(userId, type, code);
    return { accepted: true, ...(this.config.get('NODE_ENV') === 'development' ? { developmentCode: code } : {}) };
  }

  async verify(userId: string, type: 'EMAIL'|'PHONE'|'PASSWORD_RESET'|'MFA', code: string) {
    const records = await this.prisma.verificationToken.findMany({ where: { userId, type, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 3 });
    const record = (await Promise.all(records.map(async r => ({ r, ok: await argon2.verify(r.tokenHash, code) })))).find(x => x.ok)?.r;
    if (!record) { await this.fraud.verificationFailure(userId, type); throw new BadRequestException('Invalid or expired verification code'); }
    await this.prisma.withContext({ userId }, async tx => {
      await tx.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await tx.user.update({ where: { id: userId }, data: type === 'EMAIL' ? { emailVerifiedAt: new Date() } : type === 'PHONE' ? { phoneVerifiedAt: new Date() } : type === 'MFA' ? { mfaEnabled: true } : {} });
    });
    return { verified: true };
  }

  async requestPasswordReset(identifier: string) {
    const user = await this.prisma.withSystemContext(tx => tx.user.findFirst({
      where: identifier.includes('@') ? { email: identifier.toLowerCase() } : { phone: normalizePhone(identifier) as string },
    }));
    if (user) {
      const code = randomInt(100000, 1000000).toString();
      await this.prisma.verificationToken.create({ data: { userId: user.id, type: 'PASSWORD_RESET', tokenHash: await argon2.hash(code), expiresAt: new Date(Date.now() + 10 * 60_000) } });
      await this.jobs.verification(user.id, 'PASSWORD_RESET', code);
      if (this.config.get('NODE_ENV') === 'development') return { accepted: true, developmentCode: code };
    }
    return { accepted: true };
  }

  async confirmPasswordReset(identifier: string, code: string, newPassword: string) {
    const user = await this.prisma.withSystemContext(tx => tx.user.findFirst({
      where: identifier.includes('@') ? { email: identifier.toLowerCase() } : { phone: normalizePhone(identifier) as string },
    }));
    if (!user) throw new BadRequestException('Invalid or expired verification code');
    const records = await this.prisma.verificationToken.findMany({ where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 3 });
    const record = (await Promise.all(records.map(async r => ({ r, ok: await argon2.verify(r.tokenHash, code) })))).find(x => x.ok)?.r;
    if (!record) { await this.fraud.verificationFailure(user.id, 'PASSWORD_RESET'); throw new BadRequestException('Invalid or expired verification code'); }
    const newPasswordHash = await argon2.hash(newPassword);
    await this.prisma.withSystemContext(async tx => {
      await tx.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: newPasswordHash, failedLoginCount: 0, lockedUntil: null } });
      await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    return { reset: true };
  }

  private async createSession(user: { id: string; accountType: string }) {
    const expiresAt = new Date(Date.now() + this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30) * 86_400_000);
    const session = await this.prisma.session.create({ data: { userId: user.id, refreshTokenHash: 'pending', expiresAt } });
    return this.rotateSession(session.id, user);
  }
  private async rotateSession(sessionId: string, user: { id: string; accountType: string }) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, sid: sessionId, accountType: user.accountType });
    const refreshToken = await this.jwt.signAsync({ sub: user.id, sid: sessionId, accountType: user.accountType }, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: `${this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30)}d` });
    await this.prisma.session.update({ where: { id: sessionId }, data: { refreshTokenHash: await argon2.hash(refreshToken) } });
    return { accessToken, refreshToken, sessionId };
  }
}
