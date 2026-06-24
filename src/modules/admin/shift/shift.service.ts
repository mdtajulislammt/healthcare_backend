import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, ShiftApplicationStatus, ShiftStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/common/service/activity-log.service';

interface FindAllOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

@Injectable()
export class ShiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async assignStaff(shiftId: string, staffId: string, userId: string) {
    try {
      if (!shiftId || !shiftId.trim()) {
        throw new BadRequestException('Shift ID is required');
      }

      if (!staffId || !staffId.trim()) {
        throw new BadRequestException('staff_id is required');
      }

      if (!userId || !userId.trim()) {
        throw new BadRequestException('User is not authenticated');
      }

      const shift = await this.prisma.shift.findUnique({
        where: { id: shiftId },
        select: {
          id: true,
          assigned_staff_id: true,
          facility_name: true,
          posting_title: true,
          start_date: true,
          end_date: true,
          start_time: true,
          end_time: true,
        },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      if (shift.assigned_staff_id) {
        throw new ConflictException('This shift already has an assigned staff');
      }

      const staff = await this.prisma.staffProfile.findUnique({
        where: { id: staffId },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          user_id: true,
        },
      });

      if (!staff) {
        throw new NotFoundException('Staff not found');
      }

      const existingShifts = await this.prisma.shift.findMany({
        where: {
          assigned_staff_id: staffId,
          id: { not: shiftId },
        },
        select: {
          id: true,
          status: true,
          start_date: true,
          end_date: true,
          start_time: true,
          end_time: true,
        },
      });

      const targetWindow = this.getShiftWindow(
        shift.start_date,
        shift.end_date,
        shift.start_time,
        shift.end_time,
      );

      const hasOverlap = existingShifts.some((existingShift) => {
        const existingWindow = this.getShiftWindow(
          existingShift.start_date,
          existingShift.end_date,
          existingShift.start_time,
          existingShift.end_time,
        );

        return (
          targetWindow.start.getTime() < existingWindow.end.getTime() &&
          targetWindow.end.getTime() > existingWindow.start.getTime()
        );
      });

      if (hasOverlap) {
        throw new ConflictException(
          'This staff member is already assigned to another overlapping shift',
        );
      }

      const updatedShift = await this.prisma.$transaction(async (tx) => {
        const selectedApplication = await tx.shiftApplication.findFirst({
          where: {
            shift_id: shiftId,
            staff_id: staffId,
          },
          select: {
            id: true,
          },
        });

        if (selectedApplication) {
          await tx.shiftApplication.update({
            where: { id: selectedApplication.id },
            data: {
              status: ShiftApplicationStatus.accepted,
              reviewed_at: new Date(),
              notes: 'Application accepted by admin assignment',
            },
          });
        }

        await tx.shiftApplication.updateMany({
          where: {
            shift_id: shiftId,
            staff_id: { not: staffId },
          },
          data: {
            status: ShiftApplicationStatus.rejected,
            reviewed_at: new Date(),
            notes:
              'Application rejected. Shift has been assigned to another applicant.',
          },
        });

        return tx.shift.update({
          where: { id: shiftId },
          data: {
            assigned_staff_id: staffId,
            status: ShiftStatus.assigned,
          },
          select: {
            id: true,
            assigned_staff_id: true,
            facility_name: true,
            posting_title: true,
            status: true,
            assigned_staff: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                mobile_code: true,
                mobile_number: true,
                user: { select: { id: true, email: true } },
              },
            },
          },
        });
      });

      await this.activityLogService.logShiftAssign(
        userId,
        updatedShift.id,
        `${staff.first_name} ${staff.last_name}`,
        updatedShift.facility_name,
      );

      return {
        success: true,
        message: 'Staff assigned successfully',
        data: updatedShift,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to assign staff');
    }
  }

  async findAll(options: FindAllOptions) {
    try {
      const currentPage = Math.max(Number(options.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(options.limit) || 10, 1), 100);
      if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
        throw new BadRequestException('Invalid pagination parameters');
      }
      const skip = (currentPage - 1) * pageSize;

      const where: Prisma.ShiftWhereInput = {};

      if (options.status) {
        const normalizedStatus = options.status.trim().toLowerCase();
        const matchedStatus = Object.values(ShiftStatus).find(
          (value) => value.toLowerCase() === normalizedStatus,
        );
        if (matchedStatus) {
          where.status = matchedStatus;
        }
      }

      if (options.search && options.search.trim()) {
        const term = options.search.trim();
        where.OR = [
          { posting_title: { contains: term, mode: 'insensitive' } },
          { facility_name: { contains: term, mode: 'insensitive' } },
          {
            service_provider_info: {
              organization_name: { contains: term, mode: 'insensitive' },
            },
          },
        ];
      }

      const [itemsRaw, total] = await this.prisma.$transaction([
        this.prisma.shift.findMany({
          where,
          select: {
            id: true,
            posting_title: true,
            shift_type: true,
            profession_role: true,
            is_urgent: true,
            start_date: true,
            end_date: true,
            start_time: true,
            end_time: true,
            pay_rate_hourly: true,
            platform_margin: true,
            staff_hourly_rate: true,
            status: true,
            created_at: true,
            service_provider_info: {
              select: {
                id: true,
                organization_name: true,
              },
            },
            assigned_staff: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
            _count: {
              select: {
                applications: true,
              },
            },
          },
          skip,
          take: pageSize,
          orderBy: {
            created_at: 'desc',
          },
        }),
        this.prisma.shift.count({ where }),
      ]);

      const items = itemsRaw.map((s) => ({
        ...s,
        applications_count: s._count?.applications ?? 0,
        _count: undefined,
      }));

      return {
        success: true,
        message: 'Shifts fetched successfully',
        data: items,
        meta: {
          total,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to fetch shifts',
      );
    }
  }

  async findOne(id: string) {
    try {
      const shift = await this.prisma.shift.findUnique({
        where: { id },
        select: {
          id: true,
          posting_title: true,
          shift_type: true,
          profession_role: true,
          is_urgent: true,
          // schedule
          start_date: true,
          end_date: true,
          start_time: true,
          end_time: true,
          // location
          facility_name: true,
          full_address: true,
          latitude: true,
          longitude: true,
          // pay
          pay_rate_hourly: true,
          platform_margin: true,
          staff_hourly_rate: true,
          signing_bonus: true,
          internal_po_number: true,
          emergency_bonus: true,
          // other
          notes: true,
          status: true,
          created_at: true,
          updated_at: true,
          service_provider_info: {
            select: {
              id: true,
              organization_name: true,
            },
          },
          assigned_staff: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              mobile_code: true,
              mobile_number: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      const startTime = new Date(shift.start_time);
      const endTime = new Date(shift.end_time);
      let totalHours = 0;

      if (
        !Number.isNaN(startTime.getTime()) &&
        !Number.isNaN(endTime.getTime())
      ) {
        const diffMs = endTime.getTime() - startTime.getTime();
        totalHours =
          diffMs > 0 ? Number((diffMs / (1000 * 60 * 60)).toFixed(2)) : 0;
      }

      const data = {
        ...shift,
        total_hours: totalHours,
        applications_count: shift._count?.applications ?? 0,
        _count: undefined,
      } as any;

      return {
        success: true,
        message: 'Shift fetched successfully',
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to fetch shift',
      );
    }
  }

  private getShiftWindow(
    startDateValue: Date,
    endDateValue: Date | null,
    startTimeValue: Date,
    endTimeValue: Date,
  ) {
    const startDate = new Date(startDateValue);
    const endDate = new Date(endDateValue || startDateValue);
    const startTime = new Date(startTimeValue);
    const endTime = new Date(endTimeValue);

    const start = new Date(startDate);
    start.setHours(
      startTime.getHours(),
      startTime.getMinutes(),
      startTime.getSeconds(),
      startTime.getMilliseconds(),
    );

    const end = new Date(endDate);
    end.setHours(
      endTime.getHours(),
      endTime.getMinutes(),
      endTime.getSeconds(),
      endTime.getMilliseconds(),
    );

    if (end.getTime() <= start.getTime()) {
      end.setDate(end.getDate() + 1);
    }

    return { start, end };
  }

  /**
   * Export shifts as CSV based on type:
   * - filled/filed: shifts with assigned_staff_id not null
   * - unfilled: shifts with assigned_staff_id null
   * - cancelled/canceled: shifts with status = cancelled
   *
   * Date range options:
   * - daily: last 24 hours
   * - weekly: last 7 days
   * - monthly: last 30 days
   * - yearly: last 365 days
   */
  async exportShifts(
    type: string,
    options?: { search?: string; dateRange?: string },
  ): Promise<string> {
    try {
      const normalizedType = (type || '').trim().toLowerCase();
      // accept synonyms: 'filed' → 'filled', 'canceled' → 'cancelled'
      const resolvedType =
        normalizedType === 'filed'
          ? 'filled'
          : normalizedType === 'canceled'
            ? 'cancelled'
            : normalizedType;

      const where: Prisma.ShiftWhereInput = {};
      if (resolvedType === 'filled') {
        where.assigned_staff_id = { not: null };
      } else if (resolvedType === 'unfilled') {
        where.assigned_staff_id = null;
      } else if (resolvedType === 'cancelled') {
        where.status = ShiftStatus.cancelled;
      } else {
        throw new BadRequestException(
          'Invalid export type. Use filled/filed, unfilled, or cancelled.',
        );
      }

      // Apply date range filter if provided
      const dateRange = options?.dateRange?.trim().toLowerCase();
      if (dateRange) {
        const now = new Date();
        let startDate: Date;

        switch (dateRange) {
          case 'daily':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
            break;
          case 'weekly':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
            break;
          case 'monthly':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
            break;
          case 'yearly':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // Last 365 days
            break;
          default:
            throw new BadRequestException(
              'Invalid date range. Use daily, weekly, monthly, or yearly.',
            );
        }

        where.created_at = {
          gte: startDate,
        };
      }

      const term = options?.search?.trim();
      if (term) {
        where.OR = [
          { posting_title: { contains: term, mode: 'insensitive' } },
          { facility_name: { contains: term, mode: 'insensitive' } },
          {
            service_provider_info: {
              organization_name: { contains: term, mode: 'insensitive' },
            },
          },
        ];
      }

      const items = await this.prisma.shift.findMany({
        where,
        select: {
          id: true,
          posting_title: true,
          shift_type: true,
          profession_role: true,
          is_urgent: true,
          start_date: true,
          end_date: true,
          start_time: true,
          end_time: true,
          facility_name: true,
          pay_rate_hourly: true,
          platform_margin: true,
          staff_hourly_rate: true,
          status: true,
          created_at: true,
          service_provider_info: {
            select: { organization_name: true },
          },
          assigned_staff: {
            select: { first_name: true, last_name: true },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      const headers = [
        'ID',
        'Posting Title',
        'Provider',
        'Facility Name',
        'Shift Type',
        'Profession Role',
        'Is Urgent',
        'Start Date',
        'Start Time',
        'End Date',
        'End Time',
        'Pay Rate Hourly',
        'Platform Margin',
        'Staff Hourly Rate',
        'Status',
        'Assigned Staff',
        'Created At',
      ];

      const escape = (val: any): string => {
        if (val === null || val === undefined) return '';
        let s = String(val);
        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (/[",\n\r]/.test(s)) {
          s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };

      const rows = items.map((s) => {
        const assignedName = s.assigned_staff
          ? `${s.assigned_staff.first_name} ${s.assigned_staff.last_name}`
          : '';
        const providerName = s.service_provider_info?.organization_name ?? '';
        return [
          escape(s.id),
          escape(s.posting_title),
          escape(providerName),
          escape(s.facility_name),
          escape(s.shift_type),
          escape(s.profession_role),
          escape(s.is_urgent ? 'Yes' : 'No'),
          escape(s.start_date?.toISOString?.() ?? (s.start_date as any)),
          escape(s.start_time?.toISOString?.() ?? (s.start_time as any)),
          escape(
            s.end_date
              ? ((s.end_date as any).toISOString?.() ?? s.end_date)
              : '',
          ),
          escape(s.end_time?.toISOString?.() ?? (s.end_time as any)),
          escape(s.pay_rate_hourly),
          escape(s.platform_margin),
          escape(s.staff_hourly_rate),
          escape(s.status),
          escape(assignedName),
          escape(s.created_at?.toISOString?.() ?? (s.created_at as any)),
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      return csv;
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to export shifts',
      );
    }
  }
}
