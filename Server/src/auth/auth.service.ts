import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { hash, compare } from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import type { LoginDto, RegisterDto } from './auth.dto.js';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
@Injectable()
export class AuthService {
  constructor(private db: PrismaService, private jwt: JwtService, private config: ConfigService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const passwordHash = await hash(dto.password, 12);
    try {
      const user = await this.db.user.create({ data: {
        email, name: dto.name.trim(), passwordHash,
        memberships: { create: { role: 'OWNER', organization: { create: {
          name: dto.organization.trim(), slug: `workspace-${randomBytes(8).toString('hex')}`,
          currency: dto.currency ?? 'USD',
          warehouses: { create: { name: 'Main warehouse', code: 'MAIN', isDefault: true } },
          taxRates: { create: { name: 'Standard tax', rateBps: 0, isDefault: true } },
        } } } },
      }, include: { memberships: true } });
      return this.tokens(user.id, user.memberships[0].organizationId);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('An account with this email already exists');
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.db.user.findUnique({ where: { email: dto.email.toLowerCase().trim() }, include: { memberships: true } });
    if (!user || !(await compare(dto.password, user.passwordHash)) || !user.memberships.length) throw new UnauthorizedException('Invalid email or password');
    return this.tokens(user.id, user.memberships[0].organizationId);
  }

  async tokens(userId: string, orgId: string) {
    const refreshToken = randomBytes(48).toString('hex');
    await this.db.refreshSession.create({ data: { userId, tokenHash: digest(refreshToken), expiresAt: new Date(Date.now() + 7 * 86400000) } });
    return { accessToken: await this.jwt.signAsync({ sub: userId, orgId }, { secret: this.config.getOrThrow<string>('JWT_SECRET'), expiresIn: '15m' }), refreshToken };
  }

  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException();
    const session = await this.db.refreshSession.findUnique({ where: { tokenHash: digest(token) }, include: { user: { include: { memberships: true } } } });
    if (!session || session.expiresAt < new Date() || !session.user.memberships.length) throw new UnauthorizedException();
    const claimed = await this.db.refreshSession.deleteMany({ where: { id: session.id } });
    if (!claimed.count) throw new UnauthorizedException();
    return this.tokens(session.userId, session.user.memberships[0].organizationId);
  }

  async logout(token?: string) {
    if (token) await this.db.refreshSession.deleteMany({ where: { tokenHash: digest(token) } });
    return { ok: true };
  }
}
