import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TimesheetStatus, ShiftStatus, Prisma } from '@prisma/client';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) { }

    async getMetrics() {
        try {
            // Get start of current week (Monday)
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
            startOfWeek.setHours(0, 0, 0, 0);

            // Get end of current week (Sunday)
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);

            // Calculate all metrics in parallel
            const [
                activeHCPs,
                totalShifts,
                assignedShifts,
                pendingTimesheets,
                totalHoursBooked,
                careProviderTotal,
                careProviderActive,
                careProviderSuspended,
                agencyStaffTotal,
                agencyStaffActive,
                agencyStaffSuspended,
            ] = await this.prisma.$transaction([
                // Active HCPs (Healthcare Professionals) - Staff with status = 1
                this.prisma.staffProfile.count({
                    where: {
                        user: {
                            status: 1,
                        },
                    },
                }),

                // Total published shifts
                this.prisma.shift.count({
                    where: {
                        status: {
                            in: [ShiftStatus.published, ShiftStatus.assigned, ShiftStatus.completed],
                        },
                    },
                }),

                // Assigned shifts
                this.prisma.shift.count({
                    where: {
                        status: ShiftStatus.assigned,
                    },
                }),

                // Pending timesheets (submitted or under_review)
                this.prisma.shiftTimesheet.count({
                    where: {
                        status: {
                            in: [TimesheetStatus.submitted, TimesheetStatus.under_review],
                        },
                    },
                }),

                // Total hours booked this week
                this.prisma.shiftTimesheet.aggregate({
                    where: {
                        created_at: {
                            gte: startOfWeek,
                            lte: endOfWeek,
                        },
                        total_hours: {
                            not: null,
                        },
                    },
                    _sum: {
                        total_hours: true,
                    },
                }),

                // Care Provider (Service Provider) - Total
                this.prisma.serviceProviderInfo.count(),

                // Care Provider - Active (status = 1)
                this.prisma.serviceProviderInfo.count({
                    where: {
                        user: {
                            status: 1,
                        },
                    },
                }),

                // Care Provider - Suspended (status = 2)
                this.prisma.serviceProviderInfo.count({
                    where: {
                        user: {
                            status: 2,
                        },
                    },
                }),

                // Agency Staff (Worker) - Total
                this.prisma.staffProfile.count(),

                // Agency Staff - Active (status = 1)
                this.prisma.staffProfile.count({
                    where: {
                        user: {
                            status: 1,
                        },
                    },
                }),

                // Agency Staff - Suspended (status = 2)
                this.prisma.staffProfile.count({
                    where: {
                        user: {
                            status: 2,
                        },
                    },
                }),
            ]);

            // Calculate fill rate
            const fillRate = totalShifts > 0
                ? Math.round((assignedShifts / totalShifts) * 100)
                : 0;

            // Get total hours (default to 0 if null)
            const hoursBooked = totalHoursBooked._sum.total_hours || 0;

            return {
                success: true,
                message: 'Dashboard metrics fetched successfully',
                data: {
                    // Top Row KPIs
                    activeHCPs,
                    currentFillRate: fillRate,

                    // Middle Row
                    timesheetsPending: pendingTimesheets,
                    totalHoursBookedWeek: Math.round(hoursBooked * 100) / 100, // Round to 2 decimal places

                    // Right Sidebar
                    careProvider: {
                        total: careProviderTotal,
                        active: careProviderActive,
                        suspended: careProviderSuspended,
                    },
                    agencyStaff: {
                        total: agencyStaffTotal,
                        active: agencyStaffActive,
                        suspended: agencyStaffSuspended,
                    },
                },
            };
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch dashboard metrics',
            );
        }
    }

    async getMonthlyStats() {
        try {
            // Get current date
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth(); // 0-11

            // Calculate start date (10 months ago from current month)
            const startDate = new Date(currentYear, currentMonth - 9, 1); // Start of 10 months ago
            startDate.setHours(0, 0, 0, 0);

            // Calculate end date (end of current month)
            const endDate = new Date(currentYear, currentMonth + 1, 0);
            endDate.setHours(23, 59, 59, 999);

            // Get all service providers and staff created in the date range
            const [serviceProviders, staffProfiles] = await this.prisma.$transaction([
                this.prisma.serviceProviderInfo.findMany({
                    where: {
                        created_at: {
                            gte: startDate,
                            lte: endDate,
                        },
                    },
                    select: {
                        created_at: true,
                    },
                }),
                this.prisma.staffProfile.findMany({
                    where: {
                        created_at: {
                            gte: startDate,
                            lte: endDate,
                        },
                    },
                    select: {
                        created_at: true,
                    },
                }),
            ]);

            // Initialize monthly data structure
            const monthlyData: {
                month: string;
                careProvider: number;
                agencyStaff: number;
            }[] = [];

            // Generate month labels (last 10 months)
            const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            for (let i = 9; i >= 0; i--) {
                const monthDate = new Date(currentYear, currentMonth - i, 1);
                const monthLabel = monthLabels[monthDate.getMonth()];
                const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
                const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

                // Count service providers created up to this month (cumulative)
                const careProviderCount = serviceProviders.filter(
                    (sp) => new Date(sp.created_at) <= monthEnd,
                ).length;

                // Count staff profiles created up to this month (cumulative)
                const agencyStaffCount = staffProfiles.filter(
                    (staff) => new Date(staff.created_at) <= monthEnd,
                ).length;

                monthlyData.push({
                    month: monthLabel,
                    careProvider: careProviderCount,
                    agencyStaff: agencyStaffCount,
                });
            }

            return {
                success: true,
                message: 'Monthly statistics fetched successfully',
                data: monthlyData,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch monthly statistics',
            );
        }
    }

    async getTopProvidersAndStaff(options: {
        search?: string;
        status?: string; // 'active' | 'suspended' | 'all'
    }) {
        try {
            const { search, status } = options;

            // Build service provider where clause
            const providerWhere: Prisma.ServiceProviderInfoWhereInput = {};
            if (search && search.trim()) {
                const term = search.trim();
                providerWhere.OR = [
                    { organization_name: { contains: term, mode: 'insensitive' } },
                    { first_name: { contains: term, mode: 'insensitive' } },
                    { last_name: { contains: term, mode: 'insensitive' } },
                    { user: { email: { contains: term, mode: 'insensitive' } } },
                ];
            }
            if (status && status !== 'all') {
                const statusValue = status === 'active' ? 1 : status === 'suspended' ? 2 : undefined;
                if (statusValue !== undefined) {
                    providerWhere.user = {
                        status: statusValue,
                    };
                }
            }

            // Build staff where clause
            const staffWhere: Prisma.StaffProfileWhereInput = {};
            if (search && search.trim()) {
                const term = search.trim();
                staffWhere.OR = [
                    { first_name: { contains: term, mode: 'insensitive' } },
                    { last_name: { contains: term, mode: 'insensitive' } },
                    { user: { email: { contains: term, mode: 'insensitive' } } },
                ];
            }
            if (status && status !== 'all') {
                const statusValue = status === 'active' ? 1 : status === 'suspended' ? 2 : undefined;
                if (statusValue !== undefined) {
                    staffWhere.user = {
                        status: statusValue,
                    };
                }
            }

            // Fetch top 5 service providers and staff in parallel
            const [serviceProviders, staff] = await this.prisma.$transaction([
                this.prisma.serviceProviderInfo.findMany({
                    where: providerWhere,
                    select: {
                        id: true,
                        user_id: true,
                        first_name: true,
                        last_name: true,
                        organization_name: true,
                        brand_logo_url: true,
                        mobile_code: true,
                        mobile_number: true,
                        created_at: true,
                        user: {
                            select: {
                                id: true,
                                email: true,
                                status: true,
                            },
                        },
                    },
                    orderBy: { created_at: 'desc' },
                    take: 5,
                }),
                this.prisma.staffProfile.findMany({
                    where: staffWhere,
                    select: {
                        id: true,
                        user_id: true,
                        first_name: true,
                        last_name: true,
                        mobile_code: true,
                        mobile_number: true,
                        photo_url: true,
                        roles: true,
                        created_at: true,
                        user: {
                            select: {
                                id: true,
                                email: true,
                                status: true,
                            },
                        },
                    },
                    orderBy: { created_at: 'desc' },
                    take: 5,
                }),
            ]);

            // Format photo URLs if needed
            const formattedProviders = serviceProviders.map((provider) => ({
                ...provider,
                brand_logo_url: provider.brand_logo_url
                    ? SojebStorage.url(appConfig().storageUrl.brand + provider.brand_logo_url)
                    : null,
            }));

            const formattedStaff = staff.map((s) => ({
                ...s,
                photo_url: s.photo_url
                    ? SojebStorage.url(appConfig().storageUrl.staff + s.photo_url)
                    : null,
            }));

            return {
                success: true,
                message: 'Top providers and staff fetched successfully',
                data: {
                    serviceProviders: formattedProviders,
                    staff: formattedStaff,
                },
            };
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch top providers and staff',
            );
        }
    }

    async getAllDashboardData(options: {
        search?: string;
        status?: string;
    }) {
        try {
            // Fetch all data in parallel
            const [metrics, monthlyStats, topProvidersStaff] = await Promise.all([
                this.getMetrics(),
                this.getMonthlyStats(),
                this.getTopProvidersAndStaff(options),
            ]);

            return {
                success: true,
                message: 'Dashboard data fetched successfully',
                data: {
                    metrics: metrics.data,
                    monthlyStats: monthlyStats.data,
                    topProvidersStaff: topProvidersStaff.data,
                },
            };
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch dashboard data',
            );
        }
    }
}
