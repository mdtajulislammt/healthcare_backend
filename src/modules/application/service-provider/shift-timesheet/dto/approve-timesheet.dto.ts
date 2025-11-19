import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveTimesheetDto {
    @ApiPropertyOptional({
        description: 'Optional approval note for the staff member',
        example: 'All hours verified against facility log.',
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    message?: string;
}


