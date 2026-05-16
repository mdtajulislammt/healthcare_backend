import { IsString, IsOptional, IsDate } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateAdminProfileDto {
  @ApiPropertyOptional({
    description: 'Admin full name (used to split into first/last if provided)',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Phone country code (e.g., +44)' })
  @IsOptional()
  @IsString()
  mobile_code?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date_of_birth?: Date;
}
