import {
    Injectable,
    BadRequestException,
    NotFoundException,
    InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, TimesheetStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ForceApproveTimesheetDto } from './dto/force-approve-timesheet.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { PushNotificationService } from 'src/common/service/push-notification.service';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';

interface FindAllOptions {
    page?: number;
    limit?: number;
    search?: string;
    status?: string; // 'pending' | 'disputed' | 'approved' | 'all'
}

@Injectable()
export class TimesheetService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly pushNotificationService: PushNotificationService,
    ) { }

    async findAll(options: FindAllOptions) {
        try {
            const currentPage = Math.max(Number(options.page) || 1, 1);
            const pageSize = Math.min(Math.max(Number(options.limit) || 10, 1), 100);
            if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
                throw new BadRequestException('Invalid pagination parameters');
            }
            const skip = (currentPage - 1) * pageSize;

            // Build status filter
            let statusFilter: Prisma.ShiftTimesheetWhereInput['status'] = undefined;

            if (options.status && options.status !== 'all') {
                const statusFilterValue = options.status.trim().toLowerCase();
                if (statusFilterValue === 'pending') {
                    // Pending Client Review = submitted or under_review
                    statusFilter = {
                        in: [TimesheetStatus.submitted, TimesheetStatus.under_review],
                    };
                } else if (statusFilterValue === 'disputed') {
                    // Disputed = rejected
                    statusFilter = TimesheetStatus.rejected;
                } else if (statusFilterValue === 'approved') {
                    // Show approved timesheets
                    statusFilter = TimesheetStatus.approved;
                }
            } else {
                // Default: show all timesheets that need review or are processed
                // Include: pending_submission, submitted, under_review, rejected, approved
                statusFilter = {
                    in: [
                        TimesheetStatus.pending_submission,
                        TimesheetStatus.submitted,
                        TimesheetStatus.under_review,
                        TimesheetStatus.rejected,
                        TimesheetStatus.approved,
                    ],
                };
            }

            // Build search filter
            let searchFilter: Prisma.ShiftTimesheetWhereInput | undefined = undefined;
            if (options.search && options.search.trim()) {
                const term = options.search.trim();
                searchFilter = {
                    OR: [
                        {
                            shift: {
                                posting_title: { contains: term, mode: 'insensitive' },
                            },
                        },
                        {
                            shift: {
                                service_provider_info: {
                                    organization_name: { contains: term, mode: 'insensitive' },
                                },
                            },
                        },
                        {
                            staff: {
                                first_name: { contains: term, mode: 'insensitive' },
                            },
                        },
                        {
                            staff: {
                                last_name: { contains: term, mode: 'insensitive' },
                            },
                        },
                    ],
                };
            }

            // Combine status and search filters
            const where: Prisma.ShiftTimesheetWhereInput = {};
            if (statusFilter && searchFilter) {
                where.AND = [
                    { status: statusFilter },
                    searchFilter,
                ];
            } else if (statusFilter) {
                where.status = statusFilter;
            } else if (searchFilter) {
                Object.assign(where, searchFilter);
            }

            const [itemsRaw, total] = await this.prisma.$transaction([
                this.prisma.shiftTimesheet.findMany({
                    where,
                    select: {
                        id: true,
                        shift_id: true,
                        staff_id: true,
                        total_hours: true,
                        hourly_rate: true,
                        total_pay: true,
                        notes: true,
                        status: true,
                        verification_method: true,
                        clock_in_verified: true,
                        clock_out_verified: true,
                        submitted_at: true,
                        reviewed_at: true,
                        approved_by: true,
                        paid_at: true,
                        created_at: true,
                        updated_at: true,
                        shift: {
                            select: {
                                id: true,
                                posting_title: true,
                                pay_rate_hourly: true,
                                service_provider_info: {
                                    select: {
                                        id: true,
                                        organization_name: true,
                                    },
                                },
                            },
                        },
                        staff: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
                                photo_url: true,
                            },
                        },
                    },
                    skip,
                    take: pageSize,
                    orderBy: [
                        {
                            submitted_at: 'desc',
                        },
                        {
                            created_at: 'desc',
                        },
                    ],
                }),
                this.prisma.shiftTimesheet.count({ where }),
            ]);

            // Map items to include formatted data
            const items = itemsRaw.map((timesheet) => ({
                ...timesheet,
                client: timesheet.shift.service_provider_info.organization_name,
                client_rate: timesheet.shift.pay_rate_hourly,
                shift_title: timesheet.shift.posting_title,
                hcp_name: `${timesheet.staff.first_name} ${timesheet.staff.last_name}`,
                hours: timesheet.total_hours || 0,
            }));

            // Count pending timesheets
            const pendingCount = await this.prisma.shiftTimesheet.count({
                where: {
                    status: {
                        in: [TimesheetStatus.submitted, TimesheetStatus.under_review],
                    },
                },
            });

            return {
                success: true,
                message: 'Timesheets fetched successfully',
                data: items,
                pending_count: pendingCount,
                meta: {
                    total,
                    page: currentPage,
                    limit: pageSize,
                    totalPages: Math.ceil(total / pageSize) || 1,
                },
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException(error.message || 'Failed to fetch timesheets');
        }
    }

    async forceApprove(id: string, userId: string, dto: ForceApproveTimesheetDto) {
        try {
            const timesheet = await this.prisma.shiftTimesheet.findUnique({
                where: { id },
                include: {
                    shift: {
                        select: {
                            id: true,
                            posting_title: true,
                            service_provider_info: {
                                select: {
                                    id: true,
                                    organization_name: true,
                                },
                            },
                        },
                    },
                    staff: {
                        select: {
                            id: true,
                            user_id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                },
            });

            if (!timesheet) {
                throw new NotFoundException('Timesheet not found');
            }

            const updatedTimesheet = await this.prisma.shiftTimesheet.update({
                where: { id },
                data: {
                    status: TimesheetStatus.approved,
                    notes: dto.message || timesheet.notes,
                    reviewed_at: new Date(),
                    approved_by: userId,
                },
                include: {
                    shift: {
                        select: {
                            id: true,
                            posting_title: true,
                            service_provider_info: {
                                select: {
                                    id: true,
                                    organization_name: true,
                                },
                            },
                        },
                    },
                    staff: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                },
            });

            // Notify staff about approval
            const staffUserId = timesheet.staff.user_id;
            if (staffUserId) {
                await NotificationRepository.createNotification({
                    receiver_id: staffUserId,
                    text: `Your timesheet for shift "${timesheet.shift.posting_title}" has been approved.`,
                    type: 'booking',
                    entity_id: timesheet.shift.id,
                });

                await this.pushNotificationService.sendToUser(staffUserId, {
                    title: 'Timesheet approved',
                    body: `Your timesheet for "${timesheet.shift.posting_title}" has been approved.`,
                    data: {
                        timesheetId: timesheet.id,
                        shiftId: timesheet.shift.id,
                    },
                });
            }

            return {
                success: true,
                message: 'Timesheet force approved successfully',
                data: updatedTimesheet,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(error.message || 'Failed to force approve timesheet');
        }
    }

    async resolveDispute(id: string, userId: string, dto: ResolveDisputeDto) {
        try {
            const timesheet = await this.prisma.shiftTimesheet.findUnique({
                where: { id },
                include: {
                    shift: {
                        select: {
                            id: true,
                            posting_title: true,
                            service_provider_info: {
                                select: {
                                    id: true,
                                    organization_name: true,
                                },
                            },
                        },
                    },
                    staff: {
                        select: {
                            id: true,
                            user_id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                },
            });

            if (!timesheet) {
                throw new NotFoundException('Timesheet not found');
            }

            if (timesheet.status !== TimesheetStatus.rejected) {
                throw new BadRequestException('Timesheet is not in disputed status');
            }

            // Validate status - should be approved or under_review
            if (dto.status !== TimesheetStatus.approved && dto.status !== TimesheetStatus.under_review) {
                throw new BadRequestException('Invalid status for dispute resolution. Must be approved or under_review.');
            }

            const updatedTimesheet = await this.prisma.shiftTimesheet.update({
                where: { id },
                data: {
                    status: dto.status,
                    notes: dto.message || timesheet.notes,
                    reviewed_at: new Date(),
                    approved_by: userId,
                },
                include: {
                    shift: {
                        select: {
                            id: true,
                            posting_title: true,
                            service_provider_info: {
                                select: {
                                    id: true,
                                    organization_name: true,
                                },
                            },
                        },
                    },
                    staff: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                },
            });

            // Notify staff about dispute resolution
            const staffUserId = timesheet.staff.user_id;
            if (staffUserId) {
                const isApproved = dto.status === TimesheetStatus.approved;
                await NotificationRepository.createNotification({
                    receiver_id: staffUserId,
                    text: isApproved
                        ? `Your disputed timesheet for "${timesheet.shift.posting_title}" has been approved.`
                        : `Your disputed timesheet for "${timesheet.shift.posting_title}" has been moved back to review.`,
                    type: 'booking',
                    entity_id: timesheet.shift.id,
                });

                await this.pushNotificationService.sendToUser(staffUserId, {
                    title: isApproved ? 'Timesheet dispute approved' : 'Timesheet under review',
                    body: isApproved
                        ? `Your disputed timesheet for "${timesheet.shift.posting_title}" has been approved.`
                        : `Your disputed timesheet for "${timesheet.shift.posting_title}" is under review again.`,
                    data: {
                        timesheetId: timesheet.id,
                        shiftId: timesheet.shift.id,
                    },
                });
            }

            return {
                success: true,
                message: `Dispute resolved. Timesheet ${dto.status === TimesheetStatus.approved ? 'approved' : 'moved to review'}.`,
                data: updatedTimesheet,
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException(error.message || 'Failed to resolve dispute');
        }
    }
}

