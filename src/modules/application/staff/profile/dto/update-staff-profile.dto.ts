import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsIn, IsArray, MinLength, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class EmergencyContactDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Contact name', required: false })
    name?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Mobile code', required: false })
    mobile_code?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Mobile number', required: false })
    mobile_number?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Relationship', required: false })
    relationship?: string;
}

export class AddressDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Address', required: false })
    address?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'City', required: false })
    city?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'State', required: false })
    state?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'ZIP code', required: false })
    zip?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Country', required: false })
    country?: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ description: 'From date (YYYY-MM-DD)', required: false })
    from_date?: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ description: 'To date (YYYY-MM-DD)', required: false })
    to_date?: string;
}

export class UpdateStaffProfileDto {
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
    @ApiProperty({ description: 'Mobile code', required: false })
    mobile_code?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Mobile number', required: false })
    mobile_number?: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ description: 'Date of birth (YYYY-MM-DD)', required: false })
    date_of_birth?: string;

    @IsOptional()
    @IsArray()
    @IsIn(['nurse', 'senior_hca', 'hca_carer', 'support_worker'], { each: true })
    @ApiProperty({
        description: 'Staff roles',
        enum: ['nurse', 'senior_hca', 'hca_carer', 'support_worker'],
        isArray: true,
        required: false
    })
    @Transform(({ value }) => value.split(',').map((role: string) => role.trim()))
    roles?: ('nurse' | 'senior_hca' | 'hca_carer' | 'support_worker')[];

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Experience', required: false })
    experience?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Bio', required: false })
    bio?: string;

    // Emergency Contact
    @IsOptional()
    @ValidateNested()
    @Type(() => EmergencyContactDto)
    @ApiProperty({ description: 'Emergency contact information', required: false, type: () => EmergencyContactDto })
    @Transform(({ value }) => value ? JSON.parse(value) : undefined)
    emergency_contact?: EmergencyContactDto;

    // Current Address
    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    @ApiProperty({ description: 'Current address', required: false, type: () => AddressDto })
    @Transform(({ value }) => value ? JSON.parse(value) : undefined)
    current_address?: AddressDto;

    // Previous Address
    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    @ApiProperty({ description: 'Previous address', required: false, type: () => AddressDto })
    @Transform(({ value }) => value ? JSON.parse(value) : undefined)
    previous_address?: AddressDto;
}

