import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { TimesheetStatus } from '@prisma/client';

export class ResolveDisputeDto {
    @IsNotEmpty()
    @IsEnum(TimesheetStatus)
    status: TimesheetStatus;

    @ApiPropertyOptional({
        description: 'Optional resolution note',
        example: 'Dispute resolved. Timesheet approved after verification.',
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    message?: string;
}

