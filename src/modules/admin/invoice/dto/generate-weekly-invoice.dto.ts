import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateWeeklyInvoiceDto {
  @ApiProperty({
    description: 'Start date of the week (YYYY-MM-DD or ISO string)',
    example: '2026-09-01',
  })
  @IsNotEmpty()
  @IsDateString()
  start_date: string;

  @ApiProperty({
    description: 'End date of the week (YYYY-MM-DD or ISO string)',
    example: '2026-09-07',
  })
  @IsNotEmpty()
  @IsDateString()
  end_date: string;

  @ApiPropertyOptional({
    description: 'Optional Care Home / Service Provider ID. If omitted, generates invoices for all care homes with approved unbilled timesheets in this period.',
    example: 'clx...',
  })
  @IsOptional()
  @IsString()
  care_home_id?: string;

  @ApiPropertyOptional({
    description: 'Payment terms in days (e.g. 30 days due date)',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  due_days?: number = 30;
}

