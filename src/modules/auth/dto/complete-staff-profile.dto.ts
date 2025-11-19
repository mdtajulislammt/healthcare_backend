import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsIn, IsOptional, IsDateString, MinLength, IsString } from 'class-validator';

export class CompleteStaffProfileDto {
    @IsNotEmpty()
    first_name: string;

    @IsNotEmpty()
    last_name: string;

    @IsOptional()
    mobile_code?: string;

    @IsOptional()
    mobile_number?: string;

    @IsNotEmpty()
    @IsDateString()
    date_of_birth: string;

    @IsOptional()
    @IsIn(['nurse', 'senior_hca', 'hca_carer', 'support_worker'], { each: true })
    roles?: ('nurse' | 'senior_hca' | 'hca_carer' | 'support_worker')[];

    @IsNotEmpty()
    right_to_work_status: string;

    @IsOptional()
    cv_url?: string;

    @IsNotEmpty()
    @MinLength(8, { message: 'Password should be minimum 8 characters' })
    password: string;

    @IsNotEmpty()
    agreed_to_terms: boolean;

    @IsOptional()
    experience?: string;

    // Optional: DBS Info
    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'DBS certificate number', required: false })
    dbs_certificate_number?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Surname as shown on DBS certificate', required: false })
    dbs_surname_as_certificate?: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ description: 'Date of birth as shown on DBS certificate', required: false })
    dbs_date_of_birth_on_cert?: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ description: 'DBS certificate print date', required: false })
    dbs_certificate_print_date?: string;

    @IsOptional()
    @ApiProperty({ description: 'Is registered on DBS update service', required: false })
    dbs_is_registered_on_update?: boolean | string | number;
}

