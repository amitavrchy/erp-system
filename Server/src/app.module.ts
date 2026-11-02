import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AuthGuard } from './auth/auth.guard.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, JwtModule.register({})],
  controllers: [AppController, AuthController],
  providers: [AppService, AuthService, AuthGuard],
})
export class AppModule {}

