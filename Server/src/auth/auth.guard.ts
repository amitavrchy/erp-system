import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Request } from 'express';
import type { MembershipRole } from '@prisma/client';

export type Actor = { userId: string; orgId: string; role: MembershipRole };
export type AuthRequest = Request & { actor: Actor };
export const Roles = (...roles: MembershipRole[]) =>
  SetMetadata('roles', roles);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private db: PrismaService,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException();
    let claims: { sub: string; orgId: string };
    try {
      claims = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }
    const member = await this.db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: claims.orgId,
          userId: claims.sub,
        },
      },
    });
    if (!member) throw new UnauthorizedException();
    req.actor = { userId: claims.sub, orgId: claims.orgId, role: member.role };
    const readModules: Partial<Record<MembershipRole, string[]>> = {
      SALES: [
        'crm',
        'me',
        'orgs',
        'contacts',
        'companies',
        'products',
        'warehouses',
        'stock',
        'quotes',
        'sales-orders',
        'invoices',
        'tax-rates',
        'reports',
      ],
      INVENTORY: [
        'me',
        'orgs',
        'products',
        'warehouses',
        'stock',
        'vendors',
        'purchase-orders',
        'sales-orders',
        'tax-rates',
        'reports',
      ],
    };
    if (req.method === 'GET' && readModules[member.role]) {
      const module = req.path.split('/')[1];
      if (
        !readModules[member.role]!.includes(module) ||
        (module === 'reports' && req.path !== '/reports/dashboard')
      )
        throw new ForbiddenException(
          'This module is not available for your role',
        );
    }
    const roles = this.reflector.getAllAndOverride<MembershipRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      roles &&
      !['OWNER', 'ADMIN'].includes(member.role) &&
      !roles.includes(member.role)
    )
      throw new ForbiddenException('Your role cannot perform this action');
    return true;
  }
}
