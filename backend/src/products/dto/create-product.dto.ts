import { ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) slug!: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsNumber() @Min(0) price!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stockQuantity?: number;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}
