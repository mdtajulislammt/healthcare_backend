import { Type } from 'class-transformer';
import {
    IsEmail,
    IsEnum,
    IsOptional,
    IsString,
    IsBoolean,
} from 'class-validator';
import { EmployeeRole } from '@prisma/client';

export class UpdateEmployeeDto {
    @IsOptional()
    @IsString()
    first_name?: string;

    @IsOptional()
    @IsString()
    last_name?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    mobile_code?: string;

    @IsOptional()
    @IsString()
    mobile_number?: string;

    @IsOptional()
    @IsEnum(EmployeeRole)
    employee_role?: EmployeeRole;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    is_active?: boolean;
}
