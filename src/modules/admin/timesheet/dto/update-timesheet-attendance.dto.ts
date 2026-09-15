import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTimesheetAttendanceDto {
  @ApiProperty({
    description: 'Check-in time (ISO 8601 string or Date)',
    example: '2026-09-15T08:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  check_in_time: string;

  @ApiProperty({
    description: 'Check-out time (ISO 8601 string or Date)',
    example: '2026-09-15T20:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  check_out_time: string;

  @ApiPropertyOptional({
    description: 'Optional unpaid break duration in minutes to deduct from total hours',
    example: 30,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  break_minutes?: number;

  @ApiPropertyOptional({
    description: 'Optional reason or note explaining the admin adjustment',
    example: 'Staff mobile location issue resolved by admin upon manager confirmation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

