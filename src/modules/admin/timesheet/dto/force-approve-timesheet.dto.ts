import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ForceApproveTimesheetDto {
    @ApiPropertyOptional({
        description: 'Optional approval note',
        example: 'Force approved by admin due to client dispute resolution.',
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    message?: string;
}

