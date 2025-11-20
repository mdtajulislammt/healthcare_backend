import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateServiceProviderProfileDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'First name', required: false })
    first_name?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Last name', required: false })
    last_name?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Facility name', required: false })
    facility_name?: string;

    
    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Mobile code', required: false })
    mobile_code?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Mobile number', required: false })
    mobile_number?: string;
}

