import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsNotEmpty, IsIn } from 'class-validator';

export class CreateUpdateCertificateDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Certificate ID (required for update, omit for create)', required: false })
    id?: string;

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
    @ApiProperty({
        description: 'Certificate type',
        enum: [
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
        ],
        required: true,
    })
    certificate_type: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ description: 'Expiry date (YYYY-MM-DD)', required: false })
    expiry_date?: string;
}

