import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateStaffDbsInfoDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'User ID of the staff (users.id)', example: 'uuid-of-user' })
    user_id!: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'DBS certificate number', example: '001234567890' })
    certificate_number!: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'Surname as shown on certificate', example: 'Smith' })
    surname_as_certificate!: string;

    @IsNotEmpty()
    @IsDateString()
    @ApiProperty({ description: 'Date of birth as shown on certificate', example: '1990-01-01' })
    date_of_birth_on_cert!: string;

    @IsNotEmpty()
    @IsDateString()
    @ApiProperty({ description: 'Certificate print date', example: '2024-01-15' })
    certificate_print_date!: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') {
            const v = value.trim().toLowerCase();
            return v === 'true' || v === '1' || v === 'yes';
        }
        return false;
    })
    @ApiProperty({ description: 'Is registered on update service', example: false, required: false })
    is_registered_on_update?: boolean;
}

