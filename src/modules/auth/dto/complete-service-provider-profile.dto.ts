import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsIn, IsOptional, IsInt, Min, MinLength } from 'class-validator';

export class CompleteServiceProviderProfileDto {
    @IsNotEmpty()
    @ApiProperty({ description: 'First name', example: 'John' })
    first_name: string;

    @IsNotEmpty()
    @ApiProperty({ description: 'Last name', example: 'Doe' })
    last_name: string;

    @IsOptional()
    @ApiProperty({ description: 'Mobile code', example: '+44', required: false })
    mobile_code?: string;

    @IsOptional()
    @ApiProperty({ description: 'Mobile number', example: '1234567890', required: false })
    mobile_number?: string;

    @IsNotEmpty()
    @ApiProperty({ description: 'Organization name', example: 'Care Home Ltd' })
    organization_name: string;

    @IsOptional()
    @ApiProperty({ description: 'Website', example: 'https://carehome.com', required: false })
    website?: string;

    @IsNotEmpty()
    @ApiProperty({ description: 'CQC Provider Number', example: 'CQC123456' })
    cqc_provider_number: string;

    @IsOptional()
    @ApiProperty({ description: 'VAT Tax ID', example: 'GB123456789', required: false })
    vat_tax_id?: string;

    @IsNotEmpty()
    @ApiProperty({ description: 'Primary address', example: '123 Main St, London' })
    primary_address: string;

    @IsNotEmpty()
    @IsIn(['residential_care', 'domiciliary_care', 'nursing_care', 'supported_living', 'other'])
    @ApiProperty({
        description: 'Main service type',
        enum: ['residential_care', 'domiciliary_care', 'nursing_care', 'supported_living', 'other'],
        example: 'residential_care',
    })
    main_service_type: 'residential_care' | 'domiciliary_care' | 'nursing_care' | 'supported_living' | 'other';

    @IsNotEmpty()
    @IsInt()
    @Min(1)
    @ApiProperty({ description: 'Max client capacity', example: 50 })
    max_client_capacity: number;

    @IsOptional()
    @ApiProperty({ description: 'Brand logo URL', required: false })
    brand_logo_url?: string;

    @IsNotEmpty()
    @MinLength(6, { message: 'Password should be minimum 8 characters' })
    @ApiProperty({
        description: 'User password for login',
        example: 'password123',
        minLength: 8,
    })
    password: string;

    @IsNotEmpty()
    @ApiProperty({ description: 'Agreed to terms', example: true })
    agreed_to_terms: boolean;
}

