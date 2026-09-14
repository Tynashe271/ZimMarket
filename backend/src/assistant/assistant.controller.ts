import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AssistantService } from './assistant.service';

class AssistantMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(800)
  message!: string;
}

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('message')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  reply(@Body() dto: AssistantMessageDto) {
    return this.assistant.reply(dto.message);
  }
}
