import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get() async ready() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'ledgerflow-api' };
  }
}
