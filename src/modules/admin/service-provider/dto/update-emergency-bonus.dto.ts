import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEmergencyBonusDto {
    @ApiProperty({
        description: 'List of allowed emergency bonus increments (in currency units)',
        example: [10, 20, 30, 40, 50],
        type: [Number],
    })
    @IsArray()
    @ArrayNotEmpty()
    @Type(() => Number)
    @IsNumber({}, { each: true })
    @Min(0, { each: true })
    increments: number[];
}

