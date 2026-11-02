import { IsEmail, IsString, Length, IsOptional, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @Length(10, 128) password: string;
}
export class RegisterDto extends LoginDto {
  @IsString() @Length(2, 100) name: string;
  @IsString() @Length(2, 100) organization: string;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
}
export class AcceptInviteDto {
  @IsString() @Length(64, 64) token: string;
  @IsString() @Length(2, 100) name: string;
  @IsString() @Length(10, 128) password: string;
}
