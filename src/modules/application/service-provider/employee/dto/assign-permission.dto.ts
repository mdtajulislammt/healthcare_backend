import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty } from 'class-validator';
import { EmployeePermissionType } from '@prisma/client';

export class AssignPermissionDto {
  @IsNotEmpty()
  @IsArray()
  @IsEnum(EmployeePermissionType, { each: true })
  @ApiProperty({
    description: 'List of assigned permissions',
    enum: EmployeePermissionType,
    isArray: true,
    example: ['approve_timesheets', 'post_new_shifts'],
  })
  permissions: EmployeePermissionType[];
}
