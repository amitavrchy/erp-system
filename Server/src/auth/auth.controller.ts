import { Body, Controller, Post, Req, Res, UseGuards, Get, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto } from './auth.dto.js';
import { AuthGuard, type AuthRequest } from './auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

const cookie = (req: Request) => req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('lf_refresh='))?.slice(11);
@ApiTags('Authentication')
@Controller()
export class AuthController {
  constructor(private auth: AuthService, private db: PrismaService) {}
  private respond(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('lf_refresh', tokens.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/auth', maxAge: 7 * 86400000 });
    return { accessToken: tokens.accessToken };
  }
  @Post('auth/register') register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.register(dto).then(t => this.respond(res, t));
  }
  @Post('auth/login') @HttpCode(200) login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto).then(t => this.respond(res, t));
  }
  @Post('auth/refresh') @HttpCode(200) refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(cookie(req)).then(t => this.respond(res, t));
  }
  @Post('auth/logout') @HttpCode(200) logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('lf_refresh', { path: '/auth' });
    return this.auth.logout(cookie(req));
  }
  @Get('me') @UseGuards(AuthGuard) @ApiBearerAuth() async me(@Req() req: AuthRequest) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.actor.userId }, select: { id: true, name: true, email: true, memberships: { include: { organization: true } } } });
    return { ...user, activeOrgId: req.actor.orgId, role: req.actor.role };
  }
}
