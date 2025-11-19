import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsOptional, IsString, MaxLength, IsUUID, IsNotEmpty } from 'class-validator';

export class CreateStaffReviewDto {
    @ApiProperty({
        description: 'Shift ID for which the review is being left',
        example: 'shf_123456789',
    })
    @IsNotEmpty()
    @IsString()
    shift_id: string;

    @ApiProperty({
        description: 'Rating between 1 and 5',
        minimum: 1,
        maximum: 5,
        example: 4,
    })
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiProperty({
        description: 'Optional feedback about the staff performance',
        required: false,
        example: 'Handled residents very professionally throughout the night shift.',
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    feedback?: string;
}


