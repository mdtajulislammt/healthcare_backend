import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';

export class UpdateRefereeInfoDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Referee id', required: true })
  id: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Referee full name', required: false })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Referee mobile code', required: false })
  mobile_code?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Referee mobile number', required: false })
  mobile_number?: string;

  @IsOptional()
  @IsEmail()
  @ApiProperty({ description: 'Referee email', required: false })
  email?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Referee role (e.g. former manager)',
    required: false,
  })
  role?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    description: 'Referee start date (YYYY-MM-DD)',
    required: false,
  })
  start_date?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    description: 'Referee end date (YYYY-MM-DD)',
    required: false,
  })
  end_date?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }
    return false;
  })
  @ApiProperty({ description: 'Consent to contact referee', required: false })
  consent_to_contact?: boolean;
}
