import { Type } from 'class-transformer';
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
    service_provider_id?: string;

    @IsNotEmpty()
    @IsString()
    first_name: string;

    @IsNotEmpty()
    @IsString()
    last_name: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;

    @IsOptional()
    @IsString()
    mobile_code?: string;

    @IsOptional()
    @IsString()
    mobile_number?: string;

    @IsNotEmpty()
    @IsEnum(EmployeeRole)
    employee_role: EmployeeRole;

    @IsOptional()
    @IsArray()
    @IsEnum(EmployeePermissionType, { each: true })
    permissions?: EmployeePermissionType[];
}
