import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import type { LineDto } from '../common/dto.js';

export function totals(lines: Pick<LineDto, 'quantity' | 'unitPrice' | 'taxBps'>[]) {
  if (!lines.length || lines.length > 100) throw new BadRequestException('Documents require 1–100 lines');
  let subtotal = new Prisma.Decimal(0);
  let taxTotal = new Prisma.Decimal(0);
  for (const line of lines) {
    const amount = new Prisma.Decimal(line.unitPrice).mul(line.quantity).toDecimalPlaces(2);
    subtotal = subtotal.add(amount);
    taxTotal = taxTotal.add(amount.mul(line.taxBps ?? 0).div(10000).toDecimalPlaces(2));
  }
  const total = subtotal.add(taxTotal);
  if (total.greaterThan('999999999999.99')) throw new BadRequestException('Document total exceeds the supported amount');
  return { subtotal, taxTotal, total };
}
