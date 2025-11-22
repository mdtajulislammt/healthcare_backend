import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ShiftStatus, Prisma } from '@prisma/client';
import { ActivityLogService } from 'src/common/service/activity-log.service';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { DateHelper } from 'src/common/helper/date.helper';

@Injectable()
export class HomeService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly activityLogService: ActivityLogService,
    ) { }

    /**
     * Get dashboard metrics for service provider
     */
    async getDashboardMetrics(serviceProviderUserId: string) {
        try {
            // Get service provider info
            const serviceProvider = await this.prisma.serviceProviderInfo.findUnique({
                where: { user_id: serviceProviderUserId },
                select: { id: true },
            });

            if (!serviceProvider) {
                throw new NotFoundException('Service provider not found');
            }

            const serviceProviderId = serviceProvider.id;

            // Calculate metrics in parallel
            const [
                openShiftsNoApplicants,
                openShiftsWithApplicants,
                totalApplicants,
            ] = await this.prisma.$transaction([
                // Open shifts with no applicants (published status, no applications)
                this.prisma.shift.count({
                    where: {
                        service_provider_id: serviceProviderId,
                        status: ShiftStatus.published,
                        applications: {
                            none: {},
                        },
                    },
                }),

                // Open shifts with applicants (published status, has applications)
                this.prisma.shift.count({
                    where: {
                        service_provider_id: serviceProviderId,
                        status: ShiftStatus.published,
                        applications: {
                            some: {},
                        },
                    },
                }),

                // Total applicants (count all applications for this service provider's shifts)
                this.prisma.shiftApplication.count({
                    where: {
                        shift: {
                            service_provider_id: serviceProviderId,
                        },
                    },
                }),
            ]);

            // Calculate average time-to-fill manually
            // Use the application's reviewed_at date when shift was assigned
            const assignedShiftsWithApplications = await this.prisma.shift.findMany({
                where: {
                    service_provider_id: serviceProviderId,
                    status: ShiftStatus.assigned,
                    assigned_staff_id: { not: null },
                },
                select: {
                    id: true,
                    created_at: true,
                    applications: {
                        where: {
                            status: 'accepted',
                        },
                        select: {
                            reviewed_at: true,
                        },
                        take: 1,
                        orderBy: {
                            reviewed_at: 'desc',
                        },
                    },
                },
                take: 100, // Sample size for calculation
            });

            let totalDays = 0;
            let count = 0;

            for (const shift of assignedShiftsWithApplications) {
                const createdDate = new Date(shift.created_at);
                // Use reviewed_at from accepted application as assignment date
                // If not available, fall back to shift updated_at
                let assignedDate: Date;
                if (shift.applications && shift.applications.length > 0 && shift.applications[0].reviewed_at) {
                    assignedDate = new Date(shift.applications[0].reviewed_at);
                } else {
                    // Fallback: use created_at + 1 day as approximation
                    assignedDate = new Date(createdDate.getTime() + 24 * 60 * 60 * 1000);
                }

                const diffTime = assignedDate.getTime() - createdDate.getTime();
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                if (diffDays >= 0 && diffDays <= 365) { // Sanity check: max 1 year
                    totalDays += diffDays;
                    count++;
                }
            }

            const avgDays = count > 0 ? totalDays / count : 0;

            return {
                success: true,
                message: 'Dashboard metrics fetched successfully',
                data: {
                    open_shifts_no_applicants: openShiftsNoApplicants,
                    open_shifts_with_applicants: openShiftsWithApplicants,
                    total_applicants: totalApplicants,
                    avg_time_to_fill_days: parseFloat(avgDays.toFixed(1)),
                },
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch dashboard metrics',
            );
        }
    }

    /**
     * Get recent shifts for service provider
     */
    async getRecentShifts(serviceProviderUserId: string, limit: number = 10) {
        try {
            // Get service provider info
            const serviceProvider = await this.prisma.serviceProviderInfo.findUnique({
                where: { user_id: serviceProviderUserId },
                select: { id: true },
            });

            if (!serviceProvider) {
                throw new NotFoundException('Service provider not found');
            }

            const serviceProviderId = serviceProvider.id;

            // Get recent shifts
            const shifts = await this.prisma.shift.findMany({
                where: {
                    service_provider_id: serviceProviderId,
                },
                select: {
                    id: true,
                    posting_title: true,
                    profession_role: true,
                    facility_name: true,
                    start_date: true,
                    start_time: true,
                    end_time: true,
                    status: true,
                    created_at: true,
                    assigned_staff: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            roles: true,
                            photo_url: true,
                        },
                    },
                    _count: {
                        select: {
                            applications: true,
                        },
                    },
                    reviews: {
                        select: {
                            rating: true,
                        },
                        take: 1,
                        orderBy: {
                            created_at: 'desc',
                        },
                    },
                    timesheet: {
                        select: {
                            id: true,
                            status: true,
                        },
                    },
                },
                orderBy: {
                    created_at: 'desc',
                },
                take: limit,
            });

            // Format shifts
            const formattedShifts = shifts.map((shift) => {
                // Format staff name and rating
                let assignedStaffInfo = null;
                if (shift.assigned_staff) {
                    const staffRating =
                        shift.reviews && shift.reviews.length > 0
                            ? shift.reviews[0].rating
                            : null;

                    let photoUrl = null;
                    if (shift.assigned_staff.photo_url) {
                        photoUrl = SojebStorage.url(
                            appConfig().storageUrl.staff + shift.assigned_staff.photo_url,
                        );
                    }

                    assignedStaffInfo = {
                        id: shift.assigned_staff.id,
                        name: `${shift.assigned_staff.first_name} ${shift.assigned_staff.last_name}`,
                        role: shift.assigned_staff.roles?.[0] || null,
                        rating: staffRating,
                        photo_url: photoUrl,
                    };
                }

                // Determine action based on status
                let action = null;
                let actionType = null;

                if (shift.status === ShiftStatus.published) {
                    action = `View Details (${shift._count.applications} Applications)`;
                    actionType = 'view_details';
                } else if (shift.status === ShiftStatus.assigned) {
                    if (shift.timesheet && shift.timesheet.status === 'submitted') {
                        action = 'Review Timesheet';
                        actionType = 'review_timesheet';
                    } else {
                        action = 'View Details';
                        actionType = 'view_details';
                    }
                } else if (shift.status === ShiftStatus.completed) {
                    if (shift.reviews && shift.reviews.length > 0) {
                        action = 'View Rating';
                        actionType = 'view_rating';
                    } else {
                        action = 'Rate Staff';
                        actionType = 'rate_staff';
                    }
                }

                // Format date (e.g., "Jan 15, 2024")
                let formattedDate = null;
                if (shift.start_date) {
                    const date = new Date(shift.start_date);
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const month = months[date.getMonth()];
                    const day = date.getDate();
                    const year = date.getFullYear();
                    formattedDate = `${month} ${day}, ${year}`;
                }

                // Format time (e.g., "07:00 - 19:00")
                let formattedTime = null;
                if (shift.start_time && shift.end_time) {
                    const startTime = new Date(shift.start_time);
                    const endTime = new Date(shift.end_time);
                    const startHours = String(startTime.getHours()).padStart(2, '0');
                    const startMinutes = String(startTime.getMinutes()).padStart(2, '0');
                    const endHours = String(endTime.getHours()).padStart(2, '0');
                    const endMinutes = String(endTime.getMinutes()).padStart(2, '0');
                    formattedTime = `${startHours}:${startMinutes} - ${endHours}:${endMinutes}`;
                }

                return {
                    id: shift.id,
                    role: shift.posting_title || shift.profession_role,
                    location: shift.facility_name,
                    date: formattedDate,
                    time: formattedTime,
                    status: shift.status,
                    assigned_staff: assignedStaffInfo,
                    applications_count: shift._count.applications,
                    action,
                    action_type: actionType,
                };
            });

            return {
                success: true,
                message: 'Recent shifts fetched successfully',
                data: formattedShifts,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch recent shifts',
            );
        }
    }

    /**
     * Get recent activities for service provider
     */
    async getRecentActivities(serviceProviderUserId: string, limit: number = 10) {
        try {
            const result = await this.activityLogService.getUserActivities(
                serviceProviderUserId,
                {
                    page: 1,
                    limit,
                },
            );

            return {
                success: true,
                message: 'Recent activities fetched successfully',
                data: result.data,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch recent activities',
            );
        }
    }

    /**
     * Get all home data (metrics, recent shifts, recent activities) in one call
     */
    async getAllHomeData(serviceProviderUserId: string, shiftsLimit: number = 10, activitiesLimit: number = 10) {
        try {
            const [metrics, recentShifts, recentActivities] = await Promise.all([
                this.getDashboardMetrics(serviceProviderUserId),
                this.getRecentShifts(serviceProviderUserId, shiftsLimit),
                this.getRecentActivities(serviceProviderUserId, activitiesLimit),
            ]);

            return {
                success: true,
                message: 'Home data fetched successfully',
                data: {
                    metrics: metrics.data,
                    recent_shifts: recentShifts.data,
                    recent_activities: recentActivities.data,
                },
            };
        } catch (error) {
            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException
            ) {
                throw error;
            }
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch all home data',
            );
        }
    }
}
