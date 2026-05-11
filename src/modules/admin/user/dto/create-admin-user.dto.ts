import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEmail, MinLength, IsOptional } from 'class-validator';

export class CreateAdminUserDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The email of the admin user',
    example: 'admin@example.com',
  })
  email: string;

  @MinLength(6)
  @IsNotEmpty()
  @ApiProperty({
    description: 'The password of the admin user (minimum 6 characters)',
    example: 'SecurePassword123',
  })
  password: string;

  @IsOptional()
  @ApiProperty({
    description: 'First name of the admin user',
    example: 'John',
    required: false,
  })
  first_name?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Last name of the admin user',
    example: 'Doe',
    required: false,
  })
  last_name?: string;
}
