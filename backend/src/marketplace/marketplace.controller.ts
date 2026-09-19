import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { IsInt, IsMimeType, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/current-user.decorator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { MarketplaceService } from './marketplace.service';
class AdDto { @IsUUID() productId!: string; @IsString() @MinLength(2) title!: string; }
class ConversationDto { @IsUUID() businessId!: string; @IsOptional() @IsUUID() orderId?: string; }
class MessageDto { @IsString() @MinLength(1) @MaxLength(2000) body!: string; }
class DocumentDto { @IsOptional() @IsUUID() businessId?: string; @IsString() type!: string; @IsString() storageKey!: string; @IsMimeType() mimeType!: string; @IsInt() @Min(1) @Max(10_000_000) sizeBytes!: number; }
class ReportDto { @IsOptional() @IsUUID() subjectUserId?: string; @IsOptional() @IsUUID() businessId?: string; @IsString() reason!: string; @IsOptional() @IsString() details?: string; }
class UploadDto { @IsString() storageKey!:string; @IsMimeType() mimeType!:string; }
@Controller() export class MarketplaceController {
  constructor(private readonly service: MarketplaceService) {}
  @Get('public/ads') @UseInterceptors(CacheInterceptor) @CacheTTL(30_000) ads(@Query() query: PaginationQueryDto) { return this.service.publicAds(query); }
  @Post('businesses/:businessId/ads') @UseGuards(JwtAuthGuard) createAd(@CurrentUser() u: AuthUser, @Param('businessId', ParseUUIDPipe) b: string, @Body() d: AdDto) { return this.service.createAd(u.userId, b, d.productId, d.title); }
  @Post('conversations') @UseGuards(JwtAuthGuard) conversation(@CurrentUser() u: AuthUser, @Body() d: ConversationDto) { return this.service.openConversation(u.userId, u.accountType, d.businessId, d.orderId); }
  @Get('conversations') @UseGuards(JwtAuthGuard) conversations(@CurrentUser() u: AuthUser, @Query() query: PaginationQueryDto) { return this.service.conversations(u.userId, u.accountType, query); }
  @Get('conversations/:id/messages') @UseGuards(JwtAuthGuard) messages(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.service.messages(u.userId, u.accountType, id); }
  @Post('conversations/:id/messages') @UseGuards(JwtAuthGuard) send(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: MessageDto) { return this.service.sendMessage(u.userId, u.accountType, id, d.body); }
  @Post('conversations/:id/escalate') @UseGuards(JwtAuthGuard) escalate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.service.escalateConversation(u.userId, u.accountType, id); }
  @Delete('conversations/:conversationId/messages/:messageId') @UseGuards(JwtAuthGuard) deleteMessage(@CurrentUser() u: AuthUser, @Param('conversationId', ParseUUIDPipe) conversationId: string, @Param('messageId', ParseUUIDPipe) messageId: string) { return this.service.deleteMessage(u.userId, u.accountType, conversationId, messageId); }
  @Post('documents') @UseGuards(JwtAuthGuard) document(@CurrentUser() u: AuthUser, @Body() d: DocumentDto) { const { businessId, ...file } = d; return this.service.createDocument(u.userId, businessId, file); }
  @Post('documents/upload-url') @UseGuards(JwtAuthGuard) upload(@CurrentUser()u:AuthUser,@Body()d:UploadDto){return this.service.documentUpload(u.userId,d.storageKey,d.mimeType)}
  @Get('documents/:id/download-url') @UseGuards(JwtAuthGuard) download(@CurrentUser()u:AuthUser,@Param('id',ParseUUIDPipe)id:string){return this.service.documentDownload(u.userId,id)}
  @Post('reports') @UseGuards(JwtAuthGuard) report(@CurrentUser() u: AuthUser, @Body() d: ReportDto) { return this.service.report(u.userId, d); }
  @Post('businesses/:businessId/products/:productId/whatsapp-share') @UseGuards(JwtAuthGuard) whatsapp(@CurrentUser()u:AuthUser,@Param('businessId',ParseUUIDPipe)b:string,@Param('productId',ParseUUIDPipe)p:string){return this.service.whatsappShare(u.userId,b,p)}
}
