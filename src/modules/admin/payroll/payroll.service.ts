import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, TimesheetStatus } from '@prisma/client';
import { PayrollQueryDto } from './dto/payroll-query.dto';
import { MarkPayrollPaidDto } from './dto/mark-payroll-paid.dto';

export interface PayrollStaffRecord {
  staff_id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  total_hours: number;
  average_hourly_rate: number;
  basic_amount: number;
  annual_leave_rate: string;
  annual_leave_hours: number;
  annual_leave_amount: number;
  total_gross_amount: number;
  status: 'paid' | 'unpaid' | 'partially_paid';
  timesheet_count: number;
  facilities: string[];
  timesheets: {
    id: string;
    shift_id: string;
    posting_title: string;
    facility_name: string;
    start_date: string;
    total_hours: number;
    staff_hourly_rate: number;
    staff_total_pay: number;
    staff_pay_status: string;
    staff_paid_at: string | null;
  }[];
}

@Injectable()
export class PayrollService {
  private readonly ANNUAL_LEAVE_PERCENTAGE = 0.1207; // UK statutory 12.07% rolled-up holiday pay

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve and format date range. Defaults to current week (Monday 00:00 to Sunday 23:59:59).
   */
  private resolveDateRange(startDateStr?: string, endDateStr?: string): {
    start: Date;
    end: Date;
    startDateFormatted: string;
    endDateFormatted: string;
  } {
    let start: Date;
    let end: Date;

    if (startDateStr) {
      start = new Date(startDateStr);
      if (Number.isNaN(start.getTime())) {
        throw new BadRequestException('Invalid start_date format');
      }
      start.setHours(0, 0, 0, 0);
    } else {
      // Default: Monday of current week
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
    }

    if (endDateStr) {
      end = new Date(endDateStr);
      if (Number.isNaN(end.getTime())) {
        throw new BadRequestException('Invalid end_date format');
      }
      end.setHours(23, 59, 59, 999);
    } else {
      // Default: Sunday of current week
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    }

    if (start > end) {
      throw new BadRequestException('start_date cannot be greater than end_date');
    }

    const startDateFormatted = start.toISOString().split('T')[0];
    const endDateFormatted = end.toISOString().split('T')[0];

    return { start, end, startDateFormatted, endDateFormatted };
  }

  /**
   * Fetch and calculate all staff payroll records for a date range.
   */
  private async computePayrollRecords(query: PayrollQueryDto): Promise<{
    records: PayrollStaffRecord[];
    dateRange: {
      start: Date;
      end: Date;
      startDateFormatted: string;
      endDateFormatted: string;
    };
  }> {
    const dateRange = this.resolveDateRange(query.start_date, query.end_date);

    // Fetch all approved/submitted timesheets within shift start_date range
    const timesheets = await this.prisma.shiftTimesheet.findMany({
      where: {
        status: {
          in: [TimesheetStatus.approved, TimesheetStatus.submitted],
        },
        shift: {
          start_date: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        staff: {
          user: {
            deleted_at: null,
          },
        },
      },
      include: {
        shift: {
          select: {
            id: true,
            posting_title: true,
            facility_name: true,
            start_date: true,
          },
        },
        staff: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
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
      },
      orderBy: {
        shift: {
          start_date: 'asc',
        },
      },
    });

    // Group timesheets by staff_id
    const staffMap = new Map<string, {
      staff: any;
      timesheets: typeof timesheets;
    }>();

    for (const ts of timesheets) {
      if (!staffMap.has(ts.staff_id)) {
        staffMap.set(ts.staff_id, {
          staff: ts.staff,
          timesheets: [],
        });
      }
      staffMap.get(ts.staff_id)!.timesheets.push(ts);
    }

    // Transform each staff group into PayrollStaffRecord
    const allRecords: PayrollStaffRecord[] = [];

    for (const [staffId, group] of staffMap.entries()) {
      const staff = group.staff;
      const staffTimesheets = group.timesheets;

      let totalHours = 0;
      let basicAmount = 0;
      let paidTimesheetsCount = 0;
      const facilitiesSet = new Set<string>();

      const formattedTimesheets = staffTimesheets.map((ts) => {
        const hours = ts.total_hours ?? 0;
        const hourlyRate = ts.staff_hourly_rate ?? ts.hourly_rate ?? 0;
        const pay = ts.staff_total_pay ?? Number((hours * hourlyRate).toFixed(2));
        const isPaid = ts.staff_pay_status === 'paid';

        totalHours += hours;
        basicAmount += pay;
        if (isPaid) paidTimesheetsCount++;

        if (ts.shift?.facility_name) {
          facilitiesSet.add(ts.shift.facility_name);
        }

        return {
          id: ts.id,
          shift_id: ts.shift_id,
          posting_title: ts.shift?.posting_title || 'N/A',
          facility_name: ts.shift?.facility_name || 'N/A',
          start_date: ts.shift?.start_date ? ts.shift.start_date.toISOString().split('T')[0] : '',
          total_hours: Number(hours.toFixed(2)),
          staff_hourly_rate: Number(hourlyRate.toFixed(2)),
          staff_total_pay: Number(pay.toFixed(2)),
          staff_pay_status: ts.staff_pay_status || 'pending',
          staff_paid_at: ts.staff_paid_at ? ts.staff_paid_at.toISOString() : null,
        };
      });

      totalHours = Number(totalHours.toFixed(2));
      basicAmount = Number(basicAmount.toFixed(2));

      const averageHourlyRate =
        totalHours > 0 ? Number((basicAmount / totalHours).toFixed(2)) : 0;

      const annualLeaveHours = Number(
        (totalHours * this.ANNUAL_LEAVE_PERCENTAGE).toFixed(2),
      );
      const annualLeaveAmount = Number(
        (basicAmount * this.ANNUAL_LEAVE_PERCENTAGE).toFixed(2),
      );
      const totalGrossAmount = Number(
        (basicAmount + annualLeaveAmount).toFixed(2),
      );

      let status: 'paid' | 'unpaid' | 'partially_paid' = 'unpaid';
      if (paidTimesheetsCount === staffTimesheets.length && staffTimesheets.length > 0) {
        status = 'paid';
      } else if (paidTimesheetsCount > 0) {
        status = 'partially_paid';
      }

      const mobileNumber = [staff.mobile_code, staff.mobile_number]
        .filter(Boolean)
        .join(' ')
        .trim();

      allRecords.push({
        staff_id: staffId,
        name: `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'N/A',
        first_name: staff.first_name || '',
        last_name: staff.last_name || '',
        email: staff.user?.email || 'N/A',
        mobile_number: mobileNumber || 'N/A',
        total_hours: totalHours,
        average_hourly_rate: averageHourlyRate,
        basic_amount: basicAmount,
        annual_leave_rate: '12.07%',
        annual_leave_hours: annualLeaveHours,
        annual_leave_amount: annualLeaveAmount,
        total_gross_amount: totalGrossAmount,
        status,
        timesheet_count: staffTimesheets.length,
        facilities: Array.from(facilitiesSet),
        timesheets: formattedTimesheets,
      });
    }

    // Apply Search Filter
    let filteredRecords = allRecords;
    if (query.search?.trim()) {
      const searchTerm = query.search.trim().toLowerCase();
      filteredRecords = filteredRecords.filter(
        (r) =>
          r.name.toLowerCase().includes(searchTerm) ||
          r.email.toLowerCase().includes(searchTerm) ||
          r.mobile_number.toLowerCase().includes(searchTerm),
      );
    }

    // Apply Status Filter
    if (query.status && query.status !== 'all') {
      if (query.status === 'paid') {
        filteredRecords = filteredRecords.filter((r) => r.status === 'paid');
      } else if (query.status === 'unpaid') {
        filteredRecords = filteredRecords.filter(
          (r) => r.status === 'unpaid' || r.status === 'partially_paid',
        );
      }
    }

    // Sort by name ascending
    filteredRecords.sort((a, b) => a.name.localeCompare(b.name));

    return { records: filteredRecords, dateRange };
  }

  /**
   * Get paginated payroll summary JSON response.
   */
  async findAll(query: PayrollQueryDto) {
    try {
      const { records, dateRange } = await this.computePayrollRecords(query);

      const currentPage = Math.max(Number(query.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
      const skip = (currentPage - 1) * pageSize;

      const paginatedRecords = records.slice(skip, skip + pageSize);

      // Compute overall summary totals
      const totalHoursWorked = Number(
        records.reduce((sum, r) => sum + r.total_hours, 0).toFixed(2),
      );
      const totalBasicPay = Number(
        records.reduce((sum, r) => sum + r.basic_amount, 0).toFixed(2),
      );
      const totalAnnualLeaveHours = Number(
        records.reduce((sum, r) => sum + r.annual_leave_hours, 0).toFixed(2),
      );
      const totalAnnualLeavePay = Number(
        records.reduce((sum, r) => sum + r.annual_leave_amount, 0).toFixed(2),
      );
      const totalGrossPayroll = Number(
        records.reduce((sum, r) => sum + r.total_gross_amount, 0).toFixed(2),
      );
      const totalPaidCount = records.filter((r) => r.status === 'paid').length;
      const totalUnpaidCount = records.filter(
        (r) => r.status === 'unpaid' || r.status === 'partially_paid',
      ).length;

      return {
        success: true,
        message: 'Payroll summary fetched successfully',
        summary: {
          start_date: dateRange.startDateFormatted,
          end_date: dateRange.endDateFormatted,
          total_staff_count: records.length,
          total_hours_worked: totalHoursWorked,
          total_basic_pay: totalBasicPay,
          annual_leave_rate: '12.07%',
          total_annual_leave_hours: totalAnnualLeaveHours,
          total_annual_leave_pay: totalAnnualLeavePay,
          total_gross_payroll: totalGrossPayroll,
          total_paid_count: totalPaidCount,
          total_unpaid_count: totalUnpaidCount,
        },
        data: paginatedRecords,
        meta: {
          total: records.length,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(records.length / pageSize) || 1,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to fetch payroll summary',
      );
    }
  }

  /**
   * Export payroll data as a CSV string.
   */
  async exportCsv(query: PayrollQueryDto): Promise<{
    csv: string;
    filename: string;
  }> {
    try {
      const { records, dateRange } = await this.computePayrollRecords(query);

      const headers = [
        'Staff Name',
        'Email',
        'Mobile Number',
        'Total Hours Worked',
        'Avg Hourly Rate (£)',
        'Basic Amount (£)',
        'Annual Leave Rate',
        'Annual Leave Hours',
        'Annual Leave Amount (£)',
        'Total Gross Amount (£)',
        'Status',
        'Timesheets Count',
        'Facilities',
      ];

      const escapeCsv = (val: any): string => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = records.map((r) => {
        return [
          escapeCsv(r.name),
          escapeCsv(r.email),
          escapeCsv(r.mobile_number),
          escapeCsv(r.total_hours.toFixed(2)),
          escapeCsv(r.average_hourly_rate.toFixed(2)),
          escapeCsv(r.basic_amount.toFixed(2)),
          escapeCsv(r.annual_leave_rate),
          escapeCsv(r.annual_leave_hours.toFixed(2)),
          escapeCsv(r.annual_leave_amount.toFixed(2)),
          escapeCsv(r.total_gross_amount.toFixed(2)),
          escapeCsv(r.status.toUpperCase()),
          escapeCsv(r.timesheet_count),
          escapeCsv(r.facilities.join(', ')),
        ].join(',');
      });

      // Append summary total row at the bottom of CSV
      const totalHours = records.reduce((sum, r) => sum + r.total_hours, 0);
      const totalBasic = records.reduce((sum, r) => sum + r.basic_amount, 0);
      const totalLeaveHours = records.reduce((sum, r) => sum + r.annual_leave_hours, 0);
      const totalLeavePay = records.reduce((sum, r) => sum + r.annual_leave_amount, 0);
      const totalGross = records.reduce((sum, r) => sum + r.total_gross_amount, 0);

      const summaryRow = [
        escapeCsv('TOTALS'),
        escapeCsv(`Total Staff: ${records.length}`),
        escapeCsv(''),
        escapeCsv(totalHours.toFixed(2)),
        escapeCsv(''),
        escapeCsv(totalBasic.toFixed(2)),
        escapeCsv('12.07%'),
        escapeCsv(totalLeaveHours.toFixed(2)),
        escapeCsv(totalLeavePay.toFixed(2)),
        escapeCsv(totalGross.toFixed(2)),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(''),
      ].join(',');

      const csv = [headers.join(','), ...rows, '', summaryRow].join('\n');
      const filename = `payroll_${dateRange.startDateFormatted}_to_${dateRange.endDateFormatted}.csv`;

      return { csv, filename };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to export payroll CSV',
      );
    }
  }

  /**
   * Mark payroll as paid for specific timesheets or all timesheets for a staff in date range.
   */
  async markPaid(dto: MarkPayrollPaidDto, adminUserId: string) {
    try {
      let whereCondition: Prisma.ShiftTimesheetWhereInput = {};

      if (dto.timesheet_ids && dto.timesheet_ids.length > 0) {
        whereCondition = {
          id: { in: dto.timesheet_ids },
        };
      } else if (dto.staff_id) {
        const dateRange = this.resolveDateRange(dto.start_date, dto.end_date);
        whereCondition = {
          staff_id: dto.staff_id,
          status: {
            in: [TimesheetStatus.approved, TimesheetStatus.submitted],
          },
          shift: {
            start_date: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
        };
      } else {
        throw new BadRequestException(
          'Either timesheet_ids or staff_id must be provided',
        );
      }

      const updateResult = await this.prisma.shiftTimesheet.updateMany({
        where: whereCondition,
        data: {
          staff_pay_status: 'paid',
          staff_paid_at: new Date(),
        },
      });

      return {
        success: true,
        message: `Successfully marked ${updateResult.count} timesheet(s) as paid`,
        data: {
          updated_count: updateResult.count,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to mark payroll as paid');
    }
  }
}

