import { Type } from 'class-transformer';
import { IsOptional, IsString, Length, IsInt, Min, Max, IsNumber, IsEmail, IsBoolean, IsArray, IsIn, ValidateNested, IsDateString, MaxLength } from 'class-validator';

export class ListDto {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsIn(['DRAFT','OPEN','SENT','PARTIAL','PAID','VOID','CANCELLED']) status?: string;
  @IsOptional() @IsIn(['true','false']) low?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
export class MasterDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(100) companyId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(40, { each: true }) tags?: string[];
  @IsOptional() @IsString() @MaxLength(300) website?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsString() @Length(1, 60) sku?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000) unitPrice?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000) costPrice?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) reorderPoint?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @Length(1, 40) code?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10000) rateBps?: number;
}
export class LineDto {
  @IsOptional() @IsString() @MaxLength(100) productId?: string;
  @IsString() @Length(1, 300) description: string;
  @IsInt() @Min(1) @Max(1000000) quantity: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000) unitPrice: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) taxBps = 0;
}
export class DocumentDto {
  @IsOptional() @IsString() @MaxLength(100) contactId?: string;
  @IsOptional() @IsString() @MaxLength(100) vendorId?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineDto) lines: LineDto[];
}
export class AdjustmentDto {
  @IsString() productId: string;
  @IsString() warehouseId: string;
  @IsInt() @Min(-1000000) @Max(1000000) quantity: number;
  @IsString() @Length(3, 500) reason: string;
}
export class PaymentDto {
  @IsString() invoiceId: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000000) amount: number;
  @IsIn(['CASH','CARD','BANK','OTHER']) method: 'CASH' | 'CARD' | 'BANK' | 'OTHER';
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
}
export class ReceiveLineDto {
  @IsString() lineId: string;
  @IsInt() @Min(1) @Max(1000000) quantity: number;
}
export class ReceiveDto {
  @IsString() warehouseId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiveLineDto) lines: ReceiveLineDto[];
}
export class WarehouseDto { @IsString() warehouseId: string; }
export class OrgDto {
  @IsString() @Length(2, 120) name: string;
  @IsString() @Length(3, 3) currency: string;
  @IsString() @Length(2, 80) timezone: string;
}
export class MemberDto {
  @IsEmail() email: string;
  @IsIn(['ADMIN','SALES','INVENTORY','FINANCE','VIEWER']) role: 'ADMIN' | 'SALES' | 'INVENTORY' | 'FINANCE' | 'VIEWER';
}
