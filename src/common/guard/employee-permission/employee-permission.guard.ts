import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { EMPLOYEE_PERMISSION_KEY } from './employee-permission.decorator';
import { EmployeePermissionType } from '@prisma/client';

@Injectable()
export class EmployeePermissionGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private prisma: PrismaService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermissions =
            this.reflector.getAllAndOverride<EmployeePermissionType[]>(
                EMPLOYEE_PERMISSION_KEY,
                [context.getHandler(), context.getClass()],
            );

        // If no permissions are required, allow access
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const userId = request.user?.userId;

        if (!userId) {
            throw new ForbiddenException('User not authenticated');
        }

        // Fetch user to determine type
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { type: true },
        });

        if (!user) {
            throw new ForbiddenException('User not found');
        }

        // Allow service providers to bypass employee permission checks
        if (user.type === 'service_provider') {
            return true;
        }

        if (user.type !== 'employee') {
            throw new ForbiddenException('User is not authorized to access this resource');
        }

        // Check if user is an employee
        const employee = await this.prisma.employee.findFirst({
            where: {
                user_id: userId,
                is_active: true,
            },
            include: {
                permissions: {
                    where: {
                        is_granted: true,
                    },
                },
            },
        });

        if (!employee) {
            throw new ForbiddenException('User is not an active employee');
        }

        // Get employee permissions
        const employeePermissions = employee.permissions.map((p) => p.permission);

        // Check if employee has at least one of the required permissions
        const hasPermission = requiredPermissions.some((permission) =>
            employeePermissions.includes(permission),
        );

        if (!hasPermission) {
            throw new ForbiddenException(
                `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
            );
        }

        // Attach employee info to request for use in controllers
        request.employee = employee;

        return true;
    }
}