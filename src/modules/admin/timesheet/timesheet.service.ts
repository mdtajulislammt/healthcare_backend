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
import { XeroService } from 'src/modules/payment/xero/xero.service';

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
        private readonly xeroService: XeroService,
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
                } else if (statusFilterValue === 'paid') {
                    // Show paid timesheets
                    statusFilter = TimesheetStatus.paid;
                }
            } else {
                // Default: show all timesheets that need review or are processed
                // Include: pending_submission, submitted, under_review, rejected, approved, paid
                statusFilter = {
                    in: [
                        TimesheetStatus.pending_submission,
                        TimesheetStatus.submitted,
                        TimesheetStatus.under_review,
                        TimesheetStatus.rejected,
                        TimesheetStatus.approved,
                        TimesheetStatus.paid,
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
                        xero_invoice_id: true,
                        xero_invoice_number: true,
                        xero_status: true,
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

            // Create Xero invoice for approved timesheet
            let invoiceInfo = null;
            try {
                invoiceInfo = await this.xeroService.createInvoiceForTimesheet(
                    updatedTimesheet.id,
                );
            } catch (error) {
                // Log error but don't fail the approval
                console.error('Failed to create Xero invoice:', error);
            }

            return {
                success: true,
                message: 'Timesheet force approved successfully',
                data: {
                    ...updatedTimesheet,
                    invoice: invoiceInfo
                        ? {
                              invoiceId: invoiceInfo.invoiceId,
                              invoiceNumber: invoiceInfo.invoiceNumber,
                          }
                        : null,
                },
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

            // Create Xero invoice if dispute resolved to approved
            let invoiceInfo = null;
            if (dto.status === TimesheetStatus.approved) {
                try {
                    invoiceInfo = await this.xeroService.createInvoiceForTimesheet(
                        updatedTimesheet.id,
                    );
                } catch (error) {
                    // Log error but don't fail the resolution
                    console.error('Failed to create Xero invoice:', error);
                }
            }

            return {
                success: true,
                message: `Dispute resolved. Timesheet ${dto.status === TimesheetStatus.approved ? 'approved' : 'moved to review'}.`,
                data: {
                    ...updatedTimesheet,
                    invoice: invoiceInfo
                        ? {
                              invoiceId: invoiceInfo.invoiceId,
                              invoiceNumber: invoiceInfo.invoiceNumber,
                          }
                        : null,
                },
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException(error.message || 'Failed to resolve dispute');
        }
    }

    async createInvoice(timesheetId: string) {
        try {
            const invoiceInfo = await this.xeroService.createInvoiceForTimesheet(
                timesheetId,
            );

            return {
                success: true,
                message: 'Xero invoice created successfully',
                data: invoiceInfo,
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException
            ) {
                throw error;
            }
            throw new InternalServerErrorException(
                error.message || 'Failed to create invoice',
            );
        }
    }

    async syncInvoiceStatus(timesheetId: string) {
        try {
            const timesheet = await this.prisma.shiftTimesheet.findUnique({
                where: { id: timesheetId },
                select: {
                    id: true,
                    xero_invoice_id: true,
                },
            });

            if (!timesheet) {
                throw new NotFoundException('Timesheet not found');
            }

            if (!timesheet.xero_invoice_id) {
                throw new BadRequestException(
                    'Timesheet does not have a Xero invoice',
                );
            }

            await this.xeroService.updateInvoiceStatusFromXero(
                timesheet.xero_invoice_id,
            );

            // Fetch updated timesheet
            const updated = await this.prisma.shiftTimesheet.findUnique({
                where: { id: timesheetId },
                select: {
                    id: true,
                    xero_invoice_id: true,
                    xero_invoice_number: true,
                    xero_status: true,
                    status: true,
                    paid_at: true,
                },
            });

            return {
                success: true,
                message: 'Invoice status synced from Xero',
                data: updated,
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException
            ) {
                throw error;
            }
            throw new InternalServerErrorException(
                error.message || 'Failed to sync invoice status',
            );
        }
    }

    async markStaffPaid(timesheetId: string, userId: string) {
        try {
            const timesheet = await this.prisma.shiftTimesheet.findUnique({
                where: { id: timesheetId },
                select: {
                    id: true,
                    staff_pay_status: true,
                },
            });

            if (!timesheet) {
                throw new NotFoundException('Timesheet not found');
            }

            if (timesheet.staff_pay_status === 'paid') {
                throw new BadRequestException(
                    'Staff payout already marked as paid',
                );
            }

            //sync invoice status from Xero
            const invoiceStatus = await this.syncInvoiceStatus(timesheetId);
            if (invoiceStatus.data.xero_status !== 'PAID') {
                throw new BadRequestException(
                    'Invoice status is not paid',
                );
            }

            const updated = await this.prisma.shiftTimesheet.update({
                where: { id: timesheetId },
                data: {
                    staff_pay_status: 'paid',
                    staff_paid_at: new Date(),
                    paid_at: invoiceStatus.data.paid_at,
                },
                include: {
                    shift: {
                        select: {
                            id: true,
                            posting_title: true,
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

            return {
                success: true,
                message: 'Staff payout marked as paid',
                data: updated,
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException
            ) {
                throw error;
            }
            throw new InternalServerErrorException(
                error.message || 'Failed to mark staff as paid',
            );
        }
    }

    async getStaffEarnings(staffId: string) {
        try {
            const timesheets = await this.prisma.shiftTimesheet.findMany({
                where: { staff_id: staffId },
                select: {
                    id: true,
                    total_hours: true,
                    hourly_rate: true,
                    total_pay: true,
                    status: true,
                    xero_status: true,
                    staff_pay_status: true,
                    staff_paid_at: true,
                    paid_at: true,
                    shift: {
                        select: {
                            id: true,
                            posting_title: true,
                            start_date: true,
                        },
                    },
                },
                orderBy: {
                    created_at: 'desc',
                },
            });

            const totalHours = timesheets.reduce(
                (sum, t) => sum + (t.total_hours || 0),
                0,
            );
            const totalPayable = timesheets.reduce(
                (sum, t) => sum + (t.total_pay || 0),
                0,
            );

            // Calculate paid amount (where staff_pay_status = 'paid')
            const totalPaid = timesheets
                .filter((t) => t.staff_pay_status === 'paid')
                .reduce((sum, t) => sum + (t.total_pay || 0), 0);

            const outstanding = totalPayable - totalPaid;

            // Group by status
            const pending = timesheets.filter(
                (t) => t.staff_pay_status !== 'paid',
            );
            const paid = timesheets.filter(
                (t) => t.staff_pay_status === 'paid',
            );

            return {
                success: true,
                message: 'Staff earnings fetched successfully',
                data: {
                    summary: {
                        total_hours: totalHours,
                        total_payable: totalPayable,
                        total_paid: totalPaid,
                        outstanding: outstanding,
                    },
                    timesheets: {
                        pending: pending.length,
                        paid: paid.length,
                        total: timesheets.length,
                    },
                    breakdown: timesheets,
                },
            };
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch staff earnings',
            );
        }
    }

    async syncAllInvoiceStatuses() {
        try {
            // Get all timesheets with Xero invoice IDs that are not yet paid
            const timesheets = await this.prisma.shiftTimesheet.findMany({
                where: {
                    xero_invoice_id: { not: null },
                    xero_status: {
                        notIn: ['PAID'],
                    },
                },
                select: {
                    id: true,
                    xero_invoice_id: true,
                },
            });

            const results = {
                success: 0,
                failed: 0,
                errors: [] as string[],
            };

            for (const timesheet of timesheets) {
                if (!timesheet.xero_invoice_id) continue;

                try {
                    await this.xeroService.updateInvoiceStatusFromXero(
                        timesheet.xero_invoice_id,
                    );
                    results.success++;
                } catch (error) {
                    results.failed++;
                    results.errors.push(
                        `Timesheet ${timesheet.id}: ${error.message}`,
                    );
                }
            }

            return {
                success: true,
                message: `Synced ${results.success} invoices. ${results.failed} failed.`,
                data: results,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'Failed to sync invoice statuses',
            );
        }
    }

    async createBulkInvoices(timesheetIds: string[]) {
        try {
            if (!timesheetIds || timesheetIds.length === 0) {
                throw new BadRequestException('Timesheet IDs are required');
            }

            const results = {
                success: 0,
                failed: 0,
                invoices: [] as any[],
                errors: [] as string[],
            };

            for (const timesheetId of timesheetIds) {
                try {
                    const invoiceInfo =
                        await this.xeroService.createInvoiceForTimesheet(
                            timesheetId,
                        );
                    results.success++;
                    results.invoices.push({
                        timesheetId,
                        ...invoiceInfo,
                    });
                } catch (error) {
                    results.failed++;
                    results.errors.push(
                        `Timesheet ${timesheetId}: ${error.message}`,
                    );
                }
            }

            return {
                success: true,
                message: `Created ${results.success} invoices. ${results.failed} failed.`,
                data: results,
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException(
                error.message || 'Failed to create bulk invoices',
            );
        }
    }
}

