import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsEnum, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ServiceType } from '@prisma/client';

export class UpdateBusinessInfoDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Organization name', required: false })
    organization_name?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Website URL', required: false, example: 'www.yoursite.com' })
    website?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'CQC provider number', required: false, example: '564688464654646' })
    cqc_provider_number?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'VAT/Tax ID', required: false, example: '448884a646' })
    vat_tax_id?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Primary service address', required: false, example: '201, County Hall, 1c Belvedere Rd, London' })
    primary_address?: string;

    @IsOptional()
    @IsEnum(ServiceType)
    @ApiProperty({
        enum: ServiceType,
        description: 'Main service type',
        required: false,
        example: 'domiciliary_care',
    })
    main_service_type?: ServiceType;

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            return isNaN(parsed) ? value : parsed;
        }
        return value;
    })
    @IsInt()
    @Min(1)
    @ApiProperty({ description: 'Maximum client capacity', required: false, example: 50, type: Number })
    max_client_capacity?: number;
}

