import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListUsersQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateUserDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(200)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  fullName: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'at least one role is required' })
  @IsString({ each: true })
  roleIds: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  fullName?: string;
}

export class SetUserActiveDto {
  @IsBoolean()
  isActive: boolean;
}

export class SetUserRolesDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'at least one role is required' })
  @IsString({ each: true })
  roleIds: string[];
}

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(200)
  newPassword: string;
}

export class ChangeMyPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{8,}$/, {
    message:
      'password must be at least 8 characters and contain only allowed printable characters',
  })
  @MaxLength(200)
  newPassword: string;
}