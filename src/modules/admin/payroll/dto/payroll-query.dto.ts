import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class PayrollQueryDto {
  @ApiPropertyOptional({
    description: 'Start date in YYYY-MM-DD or ISO format (defaults to start of current week - Monday)',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'End date in YYYY-MM-DD or ISO format (defaults to end of current week - Sunday)',
    example: '2026-09-07',
  })
  @IsOptional()
  @IsString()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Filter by staff payout status',
    enum: ['all', 'paid', 'unpaid'],
    example: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'paid', 'unpaid'])
  status?: 'all' | 'paid' | 'unpaid';

  @ApiPropertyOptional({
    description: 'Search by staff name, email, or mobile number',
    example: 'Jane',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: '1',
  })
  @IsOptional()
  page?: string | number;

  @ApiPropertyOptional({
    description: 'Limit results per page',
    example: '10',
  })
  @IsOptional()
  limit?: string | number;
}

