import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TimesheetStatus, ShiftStatus, Prisma } from '@prisma/client';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

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
              in: [
                ShiftStatus.published,
                ShiftStatus.assigned,
                ShiftStatus.completed,
              ],
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
      const fillRate =
        totalShifts > 0 ? Math.round((assignedShifts / totalShifts) * 100) : 0;

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
        error instanceof Error
          ? error.message
          : 'Failed to fetch dashboard metrics',
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
      const monthLabels = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      for (let i = 9; i >= 0; i--) {
        const monthDate = new Date(currentYear, currentMonth - i, 1);
        const monthLabel = monthLabels[monthDate.getMonth()];
        const monthStart = new Date(
          monthDate.getFullYear(),
          monthDate.getMonth(),
          1,
        );
        const monthEnd = new Date(
          monthDate.getFullYear(),
          monthDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );

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
        error instanceof Error
          ? error.message
          : 'Failed to fetch monthly statistics',
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
        const statusValue =
          status === 'active' ? 1 : status === 'suspended' ? 2 : undefined;
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
        const statusValue =
          status === 'active' ? 1 : status === 'suspended' ? 2 : undefined;
        if (statusValue !== undefined) {
          staffWhere.user = {
            status: statusValue,
          };
        }
      }

      // Fetch top 5 service providers and staff in parallel
      const serviceProviders = await this.prisma.serviceProviderInfo.findMany({
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
          cqc_provider_number: true,
          primary_address: true,
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
      });

      // Format photo URLs if needed
      const formattedProviders = serviceProviders.map((provider) => ({
        ...provider,
        brand_logo_url: provider.brand_logo_url
          ? SojebStorage.url(
              appConfig().storageUrl.brand + provider.brand_logo_url,
            )
          : null,
      }));

      return {
        success: true,
        message: 'Top providers and staff fetched successfully',
        data: formattedProviders,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch top providers and staff',
      );
    }
  }

  async getAllDashboardData(options: {
    search?: string;
    status?: string;
    lowStarPage?: number;
    lowStarLimit?: number;
    lowStarSearch?: string;
    ratingBelow?: number;
  }) {
    try {
      // Fetch all data in parallel
      const [metrics, monthlyStats, topProvidersStaff, lowStarReviews] =
        await Promise.all([
          this.getMetrics(),
          this.getMonthlyStats(),
          this.getTopProvidersAndStaff(options),
          this.getLowStarStaffReviews({
            page: options.lowStarPage,
            limit: options.lowStarLimit,
            search: options.lowStarSearch,
            ratingBelow: options.ratingBelow,
          }),
        ]);

      return {
        success: true,
        message: 'Dashboard data fetched successfully',
        data: {
          metrics: metrics.data,
          monthlyStats: monthlyStats.data,
          topProvidersStaff: topProvidersStaff.data,
          lowStarReviews: lowStarReviews.data,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch dashboard data',
      );
    }
  }

  async getLowStarStaffReviews(options: {
    page?: number;
    limit?: number;
    search?: string;
    ratingBelow?: number;
  }) {
    try {
      const page = Math.max(Number(options.page) || 1, 1);
      const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 100);
      const skip = (page - 1) * limit;
      const search = options.search?.trim();
      const ratingBelow =
        options.ratingBelow !== undefined &&
        !Number.isNaN(Number(options.ratingBelow))
          ? Number(options.ratingBelow)
          : 3;

      if (Number.isNaN(page) || Number.isNaN(limit)) {
        throw new InternalServerErrorException('Invalid pagination parameters');
      }

      const where: Prisma.StaffPerformanceReviewWhereInput = {
        rating: { lt: ratingBelow },
        ...(search
          ? {
              OR: [
                {
                  feedback: {
                    contains: search,
                    mode: 'insensitive' as Prisma.QueryMode,
                  },
                },
                {
                  staff: {
                    is: {
                      OR: [
                        {
                          first_name: {
                            contains: search,
                            mode: 'insensitive' as Prisma.QueryMode,
                          },
                        },
                        {
                          last_name: {
                            contains: search,
                            mode: 'insensitive' as Prisma.QueryMode,
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  shift: {
                    is: {
                      posting_title: {
                        contains: search,
                        mode: 'insensitive' as Prisma.QueryMode,
                      },
                    },
                  },
                },
                {
                  provider: {
                    is: {
                      organization_name: {
                        contains: search,
                        mode: 'insensitive' as Prisma.QueryMode,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };

      const [total, reviews] = await this.prisma.$transaction([
        this.prisma.staffPerformanceReview.count({ where }),
        this.prisma.staffPerformanceReview.findMany({
          where,
          select: {
            id: true,
            provider_id: true,
            staff_id: true,
            shift_id: true,
            rating: true,
            feedback: true,
            admin_alert: true,
            created_by: true,
            created_at: true,
            staff: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                photo_url: true,
                mobile_code: true,
                mobile_number: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
            shift: {
              select: {
                id: true,
                posting_title: true,
                shift_type: true,
                profession_role: true,
                start_date: true,
                end_date: true,
                status: true,
                facility_name: true,
              },
            },
            provider: {
              select: {
                id: true,
                organization_name: true,
                primary_address: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      const data = reviews.map((review) => ({
        ...review,
        staff: review.staff
          ? {
              ...review.staff,
              photo_url: review.staff.photo_url
                ? SojebStorage.url(
                    appConfig().storageUrl.staff + review.staff.photo_url,
                  )
                : null,
            }
          : null,
      }));

      return {
        success: true,
        message: 'Low star staff reviews fetched successfully',
        data,
        meta: {
          total,
          page,
          limit,
          ratingBelow,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Failed to fetch low star staff reviews',
      );
    }
  }
}
