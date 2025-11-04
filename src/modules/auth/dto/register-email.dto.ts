import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEmail } from 'class-validator';

export class RegisterEmailDto {
    @IsNotEmpty()
    @IsEmail()
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com',
    })
    email: string;
}

