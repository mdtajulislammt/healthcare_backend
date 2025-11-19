import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectTimesheetDto {
    @ApiPropertyOptional({
        description: 'Optional reason for rejecting the timesheet',
        example: 'Missing supervisor signature on day 2.',
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    message?: string;
}


