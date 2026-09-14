import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class MarkPayrollPaidDto {
  @ApiPropertyOptional({
    description: 'Specific timesheet IDs to mark as paid',
    example: ['timesheet-id-1', 'timesheet-id-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  timesheet_ids?: string[];

  @ApiPropertyOptional({
    description: 'Staff ID to mark all timesheets as paid in date range',
    example: 'staff-profile-id',
  })
  @IsOptional()
  @IsString()
  staff_id?: string;

  @ApiPropertyOptional({
    description: 'Start date for staff bulk pay',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'End date for staff bulk pay',
    example: '2026-09-07',
  })
  @IsOptional()
  @IsString()
  end_date?: string;
}

