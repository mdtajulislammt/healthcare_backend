import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CheckInDto {
    @ApiProperty({
        description: 'Staff current latitude (optional for automatic geofence verification)',
        example: 51.5074,
        minimum: -90,
        maximum: 90,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude?: number;

    @ApiProperty({
        description: 'Staff current longitude (optional for automatic geofence verification)',
        example: -0.1278,
        minimum: -180,
        maximum: 180,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude?: number;
}

