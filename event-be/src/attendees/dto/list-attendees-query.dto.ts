import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { AttendeeRole } from '@prisma/client';

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListAttendeesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AttendeeRole, {
    message: `role must be one of: ${Object.values(AttendeeRole).join(', ')}`,
  })
  role?: AttendeeRole;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return value;
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Type(() => String)
  skills?: string[];
}
