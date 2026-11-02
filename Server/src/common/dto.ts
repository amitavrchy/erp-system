import { Type } from 'class-transformer';
import {
  ValidateIf,
  IsString,
  Length,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsEmail,
  IsBoolean,
  IsArray,
  IsIn,
  ValidateNested,
  IsDateString,
  MaxLength,
  Matches,
  IsObject,
} from 'class-validator';

export class ListDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['LEAD', 'PROSPECT', 'CUSTOMER', 'PARTNER', 'INACTIVE'])
  lifecycle?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(60)
  source?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(100)
  ownerId?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(40)
  tag?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(200)
  q?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['DRAFT', 'OPEN', 'SENT', 'PARTIAL', 'PAID', 'VOID', 'CANCELLED'])
  status?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['true', 'false'])
  low?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  from?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  to?: string;
}
export class MasterDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['LEAD', 'PROSPECT', 'CUSTOMER', 'PARTNER', 'INACTIVE'])
  lifecycle?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(60)
  source?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(100)
  ownerId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsObject() customFields?: Record<
    string,
    unknown
  >;
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  attrsJson?: Record<string, string>;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(2, 120)
  name?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsEmail()
  email?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(40)
  phone?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  title?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  companyId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(300)
  website?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  notes?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 60)
  sku?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  description?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000000)
  unitPrice?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000000)
  costPrice?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(1000000)
  reorderPoint?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 40)
  code?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBps?: number;
}
export class LineDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  productId?: string;
  @IsString() @Length(1, 300) description: string;
  @IsInt() @Min(1) @Max(1000000) quantity: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000) unitPrice: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(10000)
  taxBps = 0;
}
export class DocumentDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  contactId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  vendorId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  notes?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  dueDate?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  validUntil?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines: LineDto[];
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
  @IsIn(['CASH', 'CARD', 'BANK', 'OTHER']) method:
    'CASH' | 'CARD' | 'BANK' | 'OTHER';
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  paidAt?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(200)
  reference?: string;
}
export class ReceiveLineDto {
  @IsString() lineId: string;
  @IsInt() @Min(1) @Max(1000000) quantity: number;
}
export class ReceiveDto {
  @IsString() warehouseId: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines: ReceiveLineDto[];
}
export class WarehouseDto {
  @IsString() warehouseId: string;
}
export class OrgDto {
  @IsString() @Length(2, 120) name: string;
  @IsString() @Length(3, 3) currency: string;
  @IsString() @Length(2, 80) timezone: string;
}
export class MemberDto {
  @IsEmail() email: string;
  @IsIn(['ADMIN', 'SALES', 'INVENTORY', 'FINANCE', 'VIEWER']) role:
    'ADMIN' | 'SALES' | 'INVENTORY' | 'FINANCE' | 'VIEWER';
}
export class RoleDto {
  @IsIn(['ADMIN', 'SALES', 'INVENTORY', 'FINANCE', 'VIEWER']) role:
    'ADMIN' | 'SALES' | 'INVENTORY' | 'FINANCE' | 'VIEWER';
}
export class NoteDto {
  @IsString() @Length(1, 5000) text: string;
}
export class SequenceDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9-]{0,11}$/) prefix: string;
}
export class TemplateDto {
  @IsString() @Length(1, 200) subject: string;
  @IsString() @Length(1, 5000) body: string;
}
