import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogActionType, Prisma } from '@prisma/client';

interface LogActivityParams {
    userId: string;
    actionType: ActivityLogActionType;
    description: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

@Injectable()
export class ActivityLogService {
    constructor(private readonly prisma: PrismaService) { }

    async logActivity(params: LogActivityParams) {
        try {
            await this.prisma.activityLog.create({
                data: {
                    user_id: params.userId,
                    action_type: params.actionType,
                    description: params.description,
                    entity_type: params.entityType,
                    entity_id: params.entityId,
                    metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : null,
                    ip_address: params.ipAddress,
                    user_agent: params.userAgent,
                },
            });
        } catch (error) {
            // Log error but don't throw - activity logging should not break main functionality
            console.error('Failed to log activity:', error);
        }
    }

    async getUserActivities(
        userId: string,
        options: {
            page?: number;
            limit?: number;
            actionType?: ActivityLogActionType;
        } = {},
    ) {
        try {
            const currentPage = Math.max(Number(options.page) || 1, 1);
            const pageSize = Math.min(Math.max(Number(options.limit) || 10, 1), 100);
            const skip = (currentPage - 1) * pageSize;

            const where: Prisma.ActivityLogWhereInput = {
                user_id: userId,
            };

            if (options.actionType) {
                where.action_type = options.actionType;
            }

            const [items, total] = await this.prisma.$transaction([
                this.prisma.activityLog.findMany({
                    where,
                    select: {
                        id: true,
                        action_type: true,
                        description: true,
                        entity_type: true,
                        entity_id: true,
                        metadata: true,
                        created_at: true,
                    },
                    orderBy: {
                        created_at: 'desc',
                    },
                    skip,
                    take: pageSize,
                }),
                this.prisma.activityLog.count({ where }),
            ]);

            return {
                success: true,
                message: 'Activities fetched successfully',
                data: items,
                meta: {
                    total,
                    page: currentPage,
                    limit: pageSize,
                    totalPages: Math.ceil(total / pageSize) || 1,
                },
            };
        } catch (error) {
            throw new Error(error.message || 'Failed to fetch activities');
        }
    }

    // Helper methods for specific action types
    async logShiftApply(userId: string, shiftId: string, shiftTitle: string, facilityName: string, ipAddress?: string, userAgent?: string) {
        await this.logActivity({
            userId,
            actionType: ActivityLogActionType.shift_apply,
            description: `Applied to shift at ${facilityName}`,
            entityType: 'shift',
            entityId: shiftId,
            metadata: {
                shift_title: shiftTitle,
                facility: facilityName,
            },
            ipAddress,
            userAgent,
        });
    }

    async logTimesheetSubmit(userId: string, timesheetId: string, shiftId: string, totalHours: number, totalPay: number, ipAddress?: string, userAgent?: string) {
        await this.logActivity({
            userId,
            actionType: ActivityLogActionType.timesheet_submit,
            description: `Submitted timesheet (${totalHours} hours, $${totalPay})`,
            entityType: 'timesheet',
            entityId: timesheetId,
            metadata: {
                shift_id: shiftId,
                total_hours: totalHours,
                total_pay: totalPay,
            },
            ipAddress,
            userAgent,
        });
    }

    async logEmployeeCreate(userId: string, employeeId: string, employeeName: string, role: string, ipAddress?: string, userAgent?: string) {
        await this.logActivity({
            userId,
            actionType: ActivityLogActionType.employee_create,
            description: `Created employee: ${employeeName} (${role})`,
            entityType: 'employee',
            entityId: employeeId,
            metadata: {
                employee_name: employeeName,
                role: role,
            },
            ipAddress,
            userAgent,
        });
    }

    async logShiftCheckIn(userId: string, shiftId: string, facilityName: string, ipAddress?: string, userAgent?: string) {
        await this.logActivity({
            userId,
            actionType: ActivityLogActionType.shift_checkin,
            description: `Checked in to shift at ${facilityName}`,
            entityType: 'shift',
            entityId: shiftId,
            metadata: {
                facility: facilityName,
            },
            ipAddress,
            userAgent,
        });
    }

    async logShiftCheckOut(userId: string, shiftId: string, facilityName: string, ipAddress?: string, userAgent?: string) {
        await this.logActivity({
            userId,
            actionType: ActivityLogActionType.shift_checkout,
            description: `Checked out from shift at ${facilityName}`,
            entityType: 'shift',
            entityId: shiftId,
            metadata: {
                facility: facilityName,
            },
            ipAddress,
            userAgent,
        });
    }

    async logProfileUpdate(userId: string, updatedFields: string[], ipAddress?: string, userAgent?: string) {
        await this.logActivity({
            userId,
            actionType: ActivityLogActionType.profile_update,
            description: `Updated profile: ${updatedFields.join(', ')}`,
            entityType: 'profile',
            entityId: userId,
            metadata: {
                updated_fields: updatedFields,
            },
            ipAddress,
            userAgent,
        });
    }

    async logShiftAssign(userId: string, shiftId: string, staffName: string, facilityName: string, ipAddress?: string, userAgent?: string) {
        await this.logActivity({
            userId,
            actionType: ActivityLogActionType.shift_assign,
            description: `Assigned shift at ${facilityName} to ${staffName}`,
            entityType: 'shift',
            entityId: shiftId,
            metadata: {
                staff_name: staffName,
                facility: facilityName,
            },
            ipAddress,
            userAgent,
        });
    }

    async logTimesheetApprove(userId: string, timesheetId: string, shiftId: string, staffName: string, ipAddress?: string, userAgent?: string) {
        await this.logActivity({
            userId,
            actionType: ActivityLogActionType.timesheet_approve,
            description: `Approved timesheet for ${staffName}`,
            entityType: 'timesheet',
            entityId: timesheetId,
            metadata: {
                shift_id: shiftId,
                staff_name: staffName,
            },
            ipAddress,
            userAgent,
        });
    }

    async logTimesheetReject(userId: string, timesheetId: string, shiftId: string, staffName: string, reason?: string, ipAddress?: string, userAgent?: string) {
        await this.logActivity({
            userId,
            actionType: ActivityLogActionType.timesheet_reject,
            description: `Rejected timesheet for ${staffName}${reason ? `: ${reason}` : ''}`,
            entityType: 'timesheet',
            entityId: timesheetId,
            metadata: {
                shift_id: shiftId,
                staff_name: staffName,
                reason: reason || null,
            },
            ipAddress,
            userAgent,
        });
    }
}

