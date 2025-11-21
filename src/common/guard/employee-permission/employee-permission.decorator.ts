import { SetMetadata } from '@nestjs/common';
import { EmployeePermissionType } from '@prisma/client';

export const EMPLOYEE_PERMISSION_KEY = 'employee_permission';
export const RequireEmployeePermission = (...permissions: EmployeePermissionType[]) =>
    SetMetadata(EMPLOYEE_PERMISSION_KEY, permissions);

