import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
  @Get('metrics')
  metrics(@Res() response: Response) {
    const memory=process.memoryUsage();
    response.type('text/plain').send([`zimmarket_process_uptime_seconds ${process.uptime()}`,`zimmarket_process_resident_memory_bytes ${memory.rss}`,`zimmarket_process_heap_used_bytes ${memory.heapUsed}`].join('\n'));
  }
}
