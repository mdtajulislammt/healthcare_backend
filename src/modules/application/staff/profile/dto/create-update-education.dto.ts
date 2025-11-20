import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsNotEmpty } from 'class-validator';

export class CreateUpdateEducationDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Education ID (required for update, omit for create)', required: false })
    id?: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'Institution name', required: true })
    institution_name: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'Degree', required: true })
    degree: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Field of study', required: false })
    field_of_study?: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ description: 'Start date (YYYY-MM-DD)', required: false })
    start_date?: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ description: 'End date (YYYY-MM-DD)', required: false })
    end_date?: string;
}

