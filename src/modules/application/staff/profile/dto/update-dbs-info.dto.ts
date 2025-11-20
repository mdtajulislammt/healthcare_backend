import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateDbsInfoDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'DBS certificate number', required: false })
    certificate_number?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Surname as shown on certificate', required: false })
    surname_as_certificate?: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ description: 'Date of birth as shown on certificate (YYYY-MM-DD)', required: false })
    date_of_birth_on_cert?: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ description: 'Certificate print date (YYYY-MM-DD)', required: false })
    certificate_print_date?: string;

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
    @ApiProperty({ description: 'Is registered on update service', required: false })
    is_registered_on_update?: boolean;
}

