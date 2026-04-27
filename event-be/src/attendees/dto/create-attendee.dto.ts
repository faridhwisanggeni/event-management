import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AttendeeRole } from '@prisma/client';

export class CreateAttendeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;

  @IsOptional()
  @IsEnum(AttendeeRole, {
    message: `role must be one of: ${Object.values(AttendeeRole).join(', ')}`,
  })
  role?: AttendeeRole;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Type(() => String)
  skills?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lookingFor?: string;

  @IsOptional()
  @IsBoolean()
  openToChat?: boolean;
}
