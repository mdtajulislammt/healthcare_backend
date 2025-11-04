import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsIn } from 'class-validator';

export class SelectAccountTypeDto {
    @IsNotEmpty()
    @IsIn(['staff', 'service_provider', 'admin'], {
        message: 'Account type must be staff, service_provider, or admin',
    })
    @ApiProperty({
        description: 'Account type',
        enum: ['staff', 'service_provider', 'admin'],
        example: 'staff',
    })
    type: 'staff' | 'service_provider' | 'admin';
}

