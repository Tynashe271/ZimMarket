import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsNumber, IsString, IsUUID, Length, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; import { AuthUser } from '../auth/jwt.strategy'; import { CurrentUser } from '../common/current-user.decorator'; import { FinanceService } from './finance.service';
const paymentMethods=['ECOCASH','ONEMONEY','INNBUCKS','OMARI','TELECASH','ZIMSWITCH','VISA_MASTERCARD','ZIPIT_BANK_TRANSFER','BANK_TRANSFER','CASH_ON_DELIVERY','CASH_ON_COLLECTION'] as const;
class PayDto { @IsUUID() orderId!: string; @IsString() @IsIn(paymentMethods) provider!: string; @IsString() @MinLength(8) idempotencyKey!: string; }
class PayoutDto { @IsUUID() businessId!: string; @IsNumber() @Min(1) amount!: number; @IsString() @Length(3,3) currency!: string; @IsString() @MinLength(3) destination!: string; }
class WebhookDto { @IsString() idempotencyKey!: string; @IsString() providerRef!: string; @IsString() status!: 'SUCCEEDED'|'FAILED'; }
class RefundDto{@IsUUID()orderId!:string;@IsNumber()@Min(0.01)amount!:number;@IsString()@MinLength(3)reason!:string}class RefundReviewDto{@IsBoolean()approve!:boolean}class RefundWebhookDto{@IsUUID()refundId!:string;@IsString()providerRef!:string}
class DemoPaymentDto{@IsString()status!:'SUCCEEDED'|'FAILED'}
@Controller('finance') export class FinanceController {
  constructor(private readonly service: FinanceService) {}
  @Post('payments') @UseGuards(JwtAuthGuard) pay(@CurrentUser() u: AuthUser, @Body() d: PayDto) { return this.service.initiatePayment(u.userId, u.accountType, d.orderId, d.provider, d.idempotencyKey); }
  @Get('payments/:id/receipt') @UseGuards(JwtAuthGuard) receipt(@CurrentUser()u:AuthUser,@Param('id')id:string){return this.service.receipt(u.userId,u.accountType,id)}
  @Post('payouts') @UseGuards(JwtAuthGuard) payout(@CurrentUser() u: AuthUser, @Body() d: PayoutDto) { return this.service.requestPayout(u.userId, d.businessId, d.amount, d.currency.toUpperCase(), d.destination); }
  @Post('webhooks/payment') webhook(@Headers('x-webhook-signature') signature: string, @Body() body: WebhookDto) { return this.service.webhook(signature ?? '', body); }
  @Post('webhooks/paynow') paynowWebhook(@Body() body: Record<string,string>) { return this.service.paynowResultCallback(body); }
  @Get('payments/:id/status') @UseGuards(JwtAuthGuard) paymentStatus(@CurrentUser()u:AuthUser,@Param('id')id:string){return this.service.pollPaymentStatus(u.userId,id)}
  @Post('refunds') @UseGuards(JwtAuthGuard) refund(@CurrentUser()u:AuthUser,@Body()d:RefundDto){return this.service.requestRefund(u.userId,d.orderId,d.amount,d.reason)}
  @Post('businesses/:businessId/refunds/:id/review') @UseGuards(JwtAuthGuard) reviewRefund(@CurrentUser()u:AuthUser,@Param('businessId')b:string,@Param('id')id:string,@Body()d:RefundReviewDto){return this.service.reviewRefund(u.userId,b,id,d.approve)}
  @Post('webhooks/refund') refundWebhook(@Headers('x-webhook-signature')signature:string,@Body()d:RefundWebhookDto){return this.service.completeRefund(signature??'',d)}
  @Post('demo/payments/:id/complete') @UseGuards(JwtAuthGuard) demoPayment(@CurrentUser()u:AuthUser,@Param('id')id:string,@Body()d:DemoPaymentDto){return this.service.demoCompletePayment(u.userId,id,d.status)}
  @Post('demo/refunds/:id/complete') @UseGuards(JwtAuthGuard) demoRefund(@CurrentUser()u:AuthUser,@Param('id')id:string){return this.service.demoCompleteRefund(u.userId,id)}
}
