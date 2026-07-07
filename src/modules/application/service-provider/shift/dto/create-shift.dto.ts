import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProfessionRole, ShiftStatus, ShiftType } from '@prisma/client';

export class CreateShiftDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Service provider ID',
    example: 'sp-uuid',
  })
  service_provider_id?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Employee ID who created this shift',
    example: 'emp-uuid',
  })
  created_by_employee_id?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Assigned staff ID (if pre-assigned)',
    example: 'staff-uuid',
  })
  assigned_staff_id?: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Title of the shift posting',
    example: 'Night Shift HCA',
  })
  posting_title: string;

  @IsEnum(ShiftType)
  @ApiProperty({
    description: 'Type of shift',
    enum: ShiftType,
    example: 'day_shift',
  })
  shift_type: ShiftType;

  @IsEnum(ProfessionRole)
  @ApiProperty({
    description: 'Required professional role',
    enum: ProfessionRole,
    example: 'hca_carer',
  })
  profession_role: ProfessionRole;

  @IsBoolean()
  @Type(() => Boolean)
  @ApiProperty({ description: 'Urgency flag', example: false })
  is_urgent: boolean;

  @IsDateString()
  @ApiProperty({
    description: 'Start date of the shift (ISO format)',
    example: '2026-07-15T00:00:00.000Z',
  })
  start_date: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'End date of the shift (ISO format)',
    example: '2026-07-16T00:00:00.000Z',
  })
  end_date?: string;

  @IsDateString()
  @ApiProperty({
    description: 'Shift start time (ISO format)',
    example: '2026-07-15T08:00:00.000Z',
  })
  start_time: string;

  @IsDateString()
  @ApiProperty({
    description: 'Shift end time (ISO format)',
    example: '2026-07-15T20:00:00.000Z',
  })
  end_time: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Name of the facility/care home',
    example: 'Sunrise Nursing Home',
  })
  facility_name: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Full address of the facility',
    example: '123 Care Lane, London',
  })
  full_address: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @ApiPropertyOptional({ description: 'Signing bonus amount', example: 50.0 })
  signing_bonus?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Internal PO Number',
    example: 'PO-99128',
  })
  internal_po_number?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @ApiPropertyOptional({ description: 'Emergency bonus amount', example: 20.0 })
  emergency_bonus?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Internal admin notes',
    example: 'Please ensure HCA has uniform.',
  })
  notes?: string;

  @ApiPropertyOptional({
    enum: ShiftStatus,
    enumName: 'ShiftStatus',
    example: ShiftStatus.draft,
    required: false,
  })
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;
}
