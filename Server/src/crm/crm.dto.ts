import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNumber, IsObject, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';

export class CrmQueryDto {
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(200) q?:string;
  @Type(()=>Number) @IsInt() @Min(1) @Max(100000) page=1;
  @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=20;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(40) status?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) ownerId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) pipelineId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) stageId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) contactId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(['true','false']) overdue?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(['LOW','MEDIUM','HIGH','URGENT']) priority?:string;
}
export class CrmRecordDto {
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @Length(2,160) name?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsEmail() email?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(40) phone?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(160) company?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(60) source?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(40) status?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsInt() @Min(0) @Max(100) score?:number;
  @ValidateIf((_o,v)=>v!==undefined) @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(9999999999) value?:number;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) ownerId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) contactId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) leadId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) dealId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) stageId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) segmentId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsArray() @ArrayMaxSize(20) @IsString({each:true}) @MaxLength(40,{each:true}) tags?:string[];
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(10000) notes?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsDateString() expectedClose?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsDateString() dueAt?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsDateString() startsAt?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsDateString() endsAt?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(['LOW','MEDIUM','HIGH','URGENT']) priority?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(40) type?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(60) channel?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) category?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(500) lostReason?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(500) outcome?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(10000) resolution?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(9999999999) budget?:number;
  @ValidateIf((_o,v)=>v!==undefined) @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(9999999999) spent?:number;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(200) subject?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(10000) body?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(['LEAD','PROSPECT','CUSTOMER','PARTNER','INACTIVE','']) lifecycle?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(40) tag?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(['LEAD_CREATED','DEAL_STAGE_CHANGED','TICKET_CREATED']) trigger?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(['CREATE_TASK']) action?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @Length(2,160) taskTitle?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsInt() @Min(0) @Max(365) dueDays?:number;
  @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() enabled?:boolean;
  @ValidateIf((_o,v)=>v!==undefined) @Matches(/^[a-z][a-z0-9_]{1,39}$/) key?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(['contacts','leads','deals']) entity?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsArray() @ArrayMaxSize(30) @IsString({each:true}) @MaxLength(80,{each:true}) options?:string[];
  @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() required?:boolean;
  @ValidateIf((_o,v)=>v!==undefined) @IsObject() customFields?:Record<string,unknown>;
}
export class StageDto {
  @IsString() @Length(2,80) name:string;
  @IsInt() @Min(0) @Max(100) probability:number;
  @IsIn(['OPEN','WON','LOST']) outcome:string;
}
export class PipelineDto {
  @IsString() @Length(2,100) name:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsArray() @ArrayMaxSize(12) @ValidateNested({each:true}) @Type(()=>StageDto) stages?:StageDto[];
}
export class MoveDealDto {
  @IsString() stageId:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @Length(2,500) lostReason?:string;
}
export class ConvertLeadDto {
  @IsBoolean() createDeal:boolean;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() stageId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsObject() customFields?:Record<string,unknown>;
}
export class ReplyDto {
  @IsString() @Length(1,10000) body:string;
  @IsBoolean() isInternal:boolean;
}
export class ImportContactDto {
  @IsString() @Length(2,120) name:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsEmail() email?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(40) phone?:string;
}
export class ImportDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({each:true}) @Type(()=>ImportContactDto) rows:ImportContactDto[];
}
