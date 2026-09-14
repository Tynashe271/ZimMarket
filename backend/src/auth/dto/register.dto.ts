import { AccountType } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsObject, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsOptional() @IsEmail() email?: string;
  @IsPhoneNumber() phone!: string;
  @IsString() @MinLength(10) password!: string;
  @IsEnum(AccountType) accountType!: AccountType;
  @IsOptional() @IsString() @MinLength(2) fullName?: string;
  @IsOptional() @IsString() @MinLength(2) city?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() suburb?: string;
  @IsOptional() @IsObject() deliveryAddress?: { label?: string; address?: string; city?: string; province?: string; suburb?: string };
  @IsOptional() @IsString() notificationPreference?: string;
  @IsOptional() @IsBoolean() acceptedPolicies?: boolean;
}
