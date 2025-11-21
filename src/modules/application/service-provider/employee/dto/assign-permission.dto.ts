import { IsArray, IsEnum, IsNotEmpty } from 'class-validator';
import { EmployeePermissionType } from '@prisma/client';

export class AssignPermissionDto {
    @IsNotEmpty()
    @IsArray()
    @IsEnum(EmployeePermissionType, { each: true })
    permissions: EmployeePermissionType[];
}

