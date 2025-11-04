import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsIn, IsOptional, IsDateString, MinLength } from 'class-validator';

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
}

