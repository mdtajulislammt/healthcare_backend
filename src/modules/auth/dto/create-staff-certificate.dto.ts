import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStaffCertificateDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'User ID of the staff (users.id)', example: 'uuid-of-user' })
    user_id!: string;

    @IsNotEmpty()
    @IsString()
    @IsIn([
        'care_certificate',
        'moving_handling',
        'first_aid',
        'basic_life_support',
        'infection_control',
        'safeguarding',
        'health_safety',
        'equality_diversity',
        'coshh',
        'medication_training',
        'nvq_iii',
        'additional_training',
    ])
    @ApiProperty({ enum: ['care_certificate', 'moving_handling', 'first_aid', 'basic_life_support', 'infection_control', 'safeguarding', 'health_safety', 'equality_diversity', 'coshh', 'medication_training', 'nvq_iii', 'additional_training'] })
    certificate_type!: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ required: false, example: '2026-12-31' })
    expiry_date?: string;
}

export class CreateStaffCertificatesBulkDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'User ID of the staff (users.id)', example: 'uuid-of-user' })
    user_id!: string;

    @IsOptional()
    @IsString()
    @ApiProperty({
        description: 'Optional JSON string mapping certificate types to expiry dates. Example: {"first_aid":"2026-12-31","coshh":"2025-08-01"}',
        required: false,
        example: '{"first_aid":"2026-12-31","coshh":"2025-08-01"}'
    })
    expiries?: string;
}


