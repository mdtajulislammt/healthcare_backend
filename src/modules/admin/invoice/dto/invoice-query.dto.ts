import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceQueryDto {
  @ApiPropertyOptional({
    description: 'Start date filter (YYYY-MM-DD or ISO string)',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'End date filter (YYYY-MM-DD or ISO string)',
    example: '2026-09-30',
  })
  @IsOptional()
  @IsString()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Status filter (all | paid | unpaid | overdue | approved)',
    example: 'unpaid',
    enum: ['all', 'paid', 'unpaid', 'overdue', 'approved'],
    default: 'all',
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'paid', 'unpaid', 'overdue', 'approved'])
  status?: string = 'all';

  @ApiPropertyOptional({
    description: 'Filter by Care Home / Service Provider ID',
    example: 'clx...',
  })
  @IsOptional()
  @IsString()
  care_home_id?: string;

  @ApiPropertyOptional({
    description: 'Search query for Care Home name, invoice number, or shift title',
    example: 'Sunrise',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

