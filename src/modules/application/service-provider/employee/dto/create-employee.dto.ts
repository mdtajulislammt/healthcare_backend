import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
} from 'class-validator';
import { EmployeeRole, EmployeePermissionType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Service provider ID',
    required: false,
    example: 'sp-uuid',
  })
  service_provider_id?: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'First name', example: 'John' })
  first_name: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'Last name', example: 'Doe' })
  last_name: string;

  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @ApiProperty({
    description: 'Password',
    minLength: 6,
    example: 'password123',
  })
  password: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Mobile country code',
    required: false,
    example: '+44',
  })
  mobile_code?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Mobile phone number',
    required: false,
    example: '1234567890',
  })
  mobile_number?: string;

  @IsNotEmpty()
  @IsEnum(EmployeeRole)
  @ApiProperty({
    description: 'Employee role',
    enum: EmployeeRole,
    example: 'manager',
  })
  employee_role: EmployeeRole;

  @IsOptional()
  @IsArray()
  @IsEnum(EmployeePermissionType, { each: true })
  @ApiProperty({
    description: 'List of assigned permissions',
    enum: EmployeePermissionType,
    isArray: true,
    required: false,
    example: ['approve_timesheets'],
  })
  permissions?: EmployeePermissionType[];
}
