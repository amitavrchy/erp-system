import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AuthGuard } from './auth/auth.guard.js';
import { CatalogService } from './erp/catalog.service.js';
import { WorkflowsService } from './erp/workflows.service.js';
import { ReportsService } from './erp/reports.service.js';
import { ErpController } from './erp/erp.controller.js';
import { HealthController } from './health.controller.js';
import { CrmController } from './crm/crm.controller.js';
import { CrmService } from './crm/crm.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    JwtModule.register({}),
  ],
  controllers: [AppController, AuthController, HealthController, CrmController, ErpController],
  providers: [
    AppService,
    AuthService,
    AuthGuard,
    CatalogService,
    WorkflowsService,
    ReportsService,
    CrmService,
  ],
})
export class AppModule {}
