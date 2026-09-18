import { Controller, Get, Query } from '@nestjs/common';
import { ProviderGateway } from './provider.gateway';

// Public endpoint: it's reached by clicking an unsubscribe link in an email, so it
// cannot require a signed-in session. The signature query param is what authorizes it.
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly providers: ProviderGateway) {}

  @Get('unsubscribe')
  unsubscribe(@Query('userId') userId: string, @Query('signature') signature: string) {
    return this.providers.unsubscribeEmail(userId, signature);
  }
}
