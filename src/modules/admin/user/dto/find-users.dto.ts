import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FindUsersDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search term across email, name, organization, phone number, CQC number',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Alias for search query',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by user type (e.g. staff, service_provider, admin, user, all)',
    example: 'staff',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter by status (0/pending, 1/active, 2/suspended, all)',
    example: '1',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by approval status (approved, pending, all)',
    example: 'approved',
  })
  @IsOptional()
  @IsString()
  approved?: string;

  @ApiPropertyOptional({
    description: 'Filter by email verification (true, false, verified, unverified, all)',
    example: 'true',
  })
  @IsOptional()
  @IsString()
  is_verified?: string;

  @ApiPropertyOptional({
    description: 'Filter users created on or after date (YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsString()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter users created on or before date (YYYY-MM-DD)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsString()
  to_date?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by (created_at, updated_at, email, type, status, approved_at)',
    example: 'created_at',
    default: 'created_at',
  })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort direction (asc, desc)',
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc';
}

