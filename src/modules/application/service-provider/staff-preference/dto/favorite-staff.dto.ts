import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FavoriteStaffDto {
    @ApiPropertyOptional({
        description: 'Optional note explaining why the staff member is favorited or blocked',
        example: 'Always on time and flexible with shift changes.',
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}


