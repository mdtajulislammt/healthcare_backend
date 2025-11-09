import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplyShiftDto {
    @ApiProperty({
        description: 'The ID of the shift to apply for',
        example: 'cmhkbmyg30000ws7kiedlf61y',
    })
    @IsString()
    @IsNotEmpty()
    shift_id: string;

    @ApiPropertyOptional({
        description: 'Optional notes or message for the application',
        example: 'I am available and interested in this shift.',
    })
    @IsString()
    @IsOptional()
    notes?: string;
}
