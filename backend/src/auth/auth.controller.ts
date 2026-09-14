import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthUser } from './jwt.strategy';
import { CurrentUser } from '../common/current-user.decorator';
import { VerificationType } from '@prisma/client';
class RefreshDto { @IsString() refreshToken!: string; }
class RevokeDto { @IsUUID() sessionId!: string; }
class VerificationDto { @IsEnum(VerificationType) type!: VerificationType; }
class VerifyDto extends VerificationDto { @IsString() @MinLength(6) code!: string; }
class ProfileDto { @IsOptional() @IsString() fullName?: string; @IsOptional() @IsString() province?: string; @IsOptional() @IsString() city?: string; @IsOptional() @IsString() suburb?: string; @IsOptional() @IsString() notificationPreference?: string; @IsOptional() @IsObject() deliveryAddress?: object; }

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') @Throttle({ default: { ttl: 60_000, limit: 5 } })
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }
  @Post('login') @HttpCode(HttpStatus.OK) @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }
  @Post('admin/login') @HttpCode(HttpStatus.OK) @Throttle({ default: { ttl: 60_000, limit: 5 } })
  adminLogin(@Body() dto: LoginDto) { return this.auth.adminLogin(dto); }
  @Post('refresh') @HttpCode(HttpStatus.OK) refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }
  @Get('sessions') @UseGuards(JwtAuthGuard) sessions(@CurrentUser() user: AuthUser) { return this.auth.sessions(user.userId); }
  @Post('sessions/revoke') @UseGuards(JwtAuthGuard) revoke(@CurrentUser() user: AuthUser, @Body() dto: RevokeDto) { return this.auth.revoke(user.userId, dto.sessionId); }
  @Post('verification/request') @UseGuards(JwtAuthGuard) request(@CurrentUser() user: AuthUser, @Body() dto: VerificationDto) { return this.auth.requestVerification(user.userId, dto.type); }
  @Post('verification/confirm') @UseGuards(JwtAuthGuard) verify(@CurrentUser() user: AuthUser, @Body() dto: VerifyDto) { return this.auth.verify(user.userId, dto.type, dto.code); }
  @Get('profile') @UseGuards(JwtAuthGuard) profile(@CurrentUser() user: AuthUser) { return this.auth.profile(user.userId); }
  @Post('profile') @UseGuards(JwtAuthGuard) updateProfile(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) { return this.auth.updateProfile(user.userId, dto); }
}
