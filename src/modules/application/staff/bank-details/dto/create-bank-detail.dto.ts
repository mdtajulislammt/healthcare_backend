import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, Matches, Length } from 'class-validator';

export class CreateBankDetailDto {
    @ApiProperty({ description: 'Account holder name', example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    account_holder_name: string;

    @ApiProperty({ description: 'UK Sort Code (6 digits)', example: '12-34-56' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[0-9]{2}-[0-9]{2}-[0-9]{2}$/, {
        message: 'Sort code must be in format XX-XX-XX (e.g., 12-34-56)',
    })
    sort_code: string;

    @ApiProperty({ description: 'UK Account Number (8 digits)', example: '12345678' })
    @IsString()
    @IsNotEmpty()
    @Length(8, 8, { message: 'Account number must be exactly 8 digits' })
    @Matches(/^[0-9]{8}$/, {
        message: 'Account number must be exactly 8 digits',
    })
    account_number: string;

    @ApiPropertyOptional({ description: 'Bank name', example: 'Barclays' })
    @IsString()
    @IsOptional()
    bank_name?: string;
}
