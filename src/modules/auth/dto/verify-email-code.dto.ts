import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEmail } from 'class-validator';

export class VerifyEmailCodeDto {
    @IsNotEmpty()
    @IsEmail()
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com',
    })
    email: string;

    @IsNotEmpty()
    @ApiProperty({
        description: '6-digit verification code',
        example: '123456',
    })
    code: string;
}

