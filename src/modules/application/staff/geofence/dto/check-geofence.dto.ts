import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class CheckGeofenceDto {
    @ApiProperty({
        description: 'Staff current latitude',
        example: 51.5074,
        minimum: -90,
        maximum: 90,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number;

    @ApiProperty({
        description: 'Staff current longitude',
        example: -0.1278,
        minimum: -180,
        maximum: 180,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number;
}

