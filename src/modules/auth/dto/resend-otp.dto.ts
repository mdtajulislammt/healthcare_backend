import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEmail } from 'class-validator';

export class ResendOtpDto {
    @IsNotEmpty()
    @IsEmail()
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com',
    })
    email: string;

    @IsNotEmpty()
    @ApiProperty({
        description: 'User ID',
        example: 'user_id_123',
    })
    user_id: string;
}

