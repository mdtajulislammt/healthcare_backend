import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  Length,
} from 'class-validator';

export class CreateBankDetailDto {
  @ApiProperty({ description: 'Account holder name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  account_holder_name: string;

  @ApiProperty({ description: 'UK Sort Code (6 digits)', example: '12-34-56' })
  @IsString()
  @IsNotEmpty()
  sort_code: string;

  @ApiProperty({
    description: 'UK Account Number (8 digits)',
    example: '12345678',
  })
  @IsString()
  @IsNotEmpty()
  account_number: string;

  @ApiPropertyOptional({ description: 'Bank name', example: 'Barclays' })
  @IsString()
  @IsOptional()
  bank_name?: string;
}
