import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftApplicationStatus } from '@prisma/client';

export class AcceptApplicationDto {
    @ApiProperty({
        description: 'The action to perform on the application',
        enum: ['accepted', 'rejected'],
        example: 'accepted',
    })
    @IsEnum(['accepted', 'rejected'])
    action: 'accepted' | 'rejected';

    @ApiPropertyOptional({
        description: 'Optional notes or reason for accepting/rejecting',
        example: 'Applicant meets all requirements and is available.',
    })
    @IsString()
    @IsOptional()
    notes?: string;
}

