import { EmployeeRole, EmployeePermissionType } from '@prisma/client';

export class EmployeeEntity {
    id: string;
    user_id: string | null;
    service_provider_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
    employee_role: EmployeeRole;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    permissions?: {
        id: string;
        permission: EmployeePermissionType;
        is_granted: boolean;
    }[];
    user?: {
        id: string;
        email: string;
        type: string;
    };
}
