import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

type AuthRequest = Request & { user: AuthUser };

@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('public/products')
  listPublic() { return this.products.listPublic(); }

  @Get('storefront/products') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  listStorefront(@Req() req: AuthRequest) { return this.products.listStorefront(req.user.accountType); }

  @Get('businesses/:businessId/products') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  listBusiness(@Req() req: AuthRequest, @Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.products.listForBusiness(req.user.userId, businessId);
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
