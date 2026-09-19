import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { PaginationQueryDto } from '../common/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

type AuthRequest = Request & { user: AuthUser };

@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('public/products') @UseInterceptors(CacheInterceptor) @CacheTTL(30_000)
  listPublic(@Query() query: PaginationQueryDto) { return this.products.listPublic(query); }

  @Get('storefront/products') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  listStorefront(@Req() req: AuthRequest, @Query() query: PaginationQueryDto) { return this.products.listStorefront(req.user.accountType, query); }

  @Get('businesses/:businessId/products') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  listBusiness(@Req() req: AuthRequest, @Param('businessId', ParseUUIDPipe) businessId: string, @Query() query: PaginationQueryDto) {
    return this.products.listForBusiness(req.user.userId, businessId, query);
  }

  @Post('businesses/:businessId/products') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  create(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.products.create(req.user.userId, businessId, dto);
  }
}
