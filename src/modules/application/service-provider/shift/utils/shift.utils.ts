import { BadRequestException } from '@nestjs/common';
import { Prisma, ShiftStatus, ShiftType } from '@prisma/client';
import { ActivityLogService } from 'src/common/service/activity-log.service';
import { PrismaService } from 'src/prisma/prisma.service';

export interface ShiftDateConfig {
  startDate: Date;
  endDate: Date;
  startTime: Date;
  endTime: Date;
}

/**
 * Determine if a shift is overnight (crosses midnight into the next day)
 */
export function isOvernightShift(
  startTimeValue: string | Date,
  endTimeValue: string | Date,
  shiftType?: ShiftType,
): boolean {
  if (shiftType === ShiftType.night) {
    return true;
  }

  const start = new Date(startTimeValue);
  const end = new Date(endTimeValue);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
  const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();

  // If end time is earlier than or equal to start time (e.g. 20:00 to 08:00), it crosses midnight
  return endMinutes <= startMinutes;
}

/**
 * Generates accurate Shift configurations for single or recurring shifts,
 * correctly handling overnight/night shifts without producing duplicate next-day shifts.
 */
export function generateShiftConfigs(params: {
  startDateValue: string | Date;
  endDateValue?: string | Date | null;
  startTimeValue: string | Date;
  endTimeValue: string | Date;
  shiftType?: ShiftType;
}): ShiftDateConfig[] {
  const startDate = new Date(params.startDateValue);
  if (Number.isNaN(startDate.getTime())) {
    throw new BadRequestException('Invalid start_date value');
  }

  const endDate = params.endDateValue
    ? new Date(params.endDateValue)
    : new Date(startDate);
  if (Number.isNaN(endDate.getTime())) {
    throw new BadRequestException('Invalid end_date value');
  }

  const startTimeObj = new Date(params.startTimeValue);
  const endTimeObj = new Date(params.endTimeValue);
  if (
    Number.isNaN(startTimeObj.getTime()) ||
    Number.isNaN(endTimeObj.getTime())
  ) {
    throw new BadRequestException('Invalid start_time or end_time value');
  }

  const startCalendar = new Date(startDate);
  startCalendar.setUTCHours(0, 0, 0, 0);

  const endCalendar = new Date(endDate);
  endCalendar.setUTCHours(0, 0, 0, 0);

  if (endCalendar.getTime() < startCalendar.getTime()) {
    throw new BadRequestException(
      'end_date must be greater than or equal to start_date',
    );
  }

  const diffDays = Math.round(
    (endCalendar.getTime() - startCalendar.getTime()) / (24 * 60 * 60 * 1000),
  );

  const overnight = isOvernightShift(
    params.startTimeValue,
    params.endTimeValue,
    params.shiftType,
  );

  const startHours = startTimeObj.getUTCHours();
  const startMinutes = startTimeObj.getUTCMinutes();
  const startSeconds = startTimeObj.getUTCSeconds();

  const endHours = endTimeObj.getUTCHours();
  const endMinutes = endTimeObj.getUTCMinutes();
  const endSeconds = endTimeObj.getUTCSeconds();

  const configs: ShiftDateConfig[] = [];

  if (overnight) {
    // If diffDays <= 1 (e.g. start: 15th, end: 16th), it is ONE single night shift that ends the next morning!
    if (diffDays <= 1) {
      const shiftStart = new Date(startCalendar);
      const shiftEnd = new Date(startCalendar);
      shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);

      const shiftStartTime = new Date(shiftStart);
      shiftStartTime.setUTCHours(startHours, startMinutes, startSeconds, 0);

      const shiftEndTime = new Date(shiftEnd);
      shiftEndTime.setUTCHours(endHours, endMinutes, endSeconds, 0);

      configs.push({
        startDate: shiftStart,
        endDate: shiftEnd,
        startTime: shiftStartTime,
        endTime: shiftEndTime,
      });
    } else {
      // Multi-night range: diffDays > 1 (e.g. from 15th to 18th = 3 night shifts starting 15th, 16th, 17th)
      const current = new Date(startCalendar);
      while (current.getTime() < endCalendar.getTime()) {
        const shiftStart = new Date(current);
        const shiftEnd = new Date(current);
        shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);

        const shiftStartTime = new Date(shiftStart);
        shiftStartTime.setUTCHours(startHours, startMinutes, startSeconds, 0);

        const shiftEndTime = new Date(shiftEnd);
        shiftEndTime.setUTCHours(endHours, endMinutes, endSeconds, 0);

        configs.push({
          startDate: shiftStart,
          endDate: shiftEnd,
          startTime: shiftStartTime,
          endTime: shiftEndTime,
        });

        current.setUTCDate(current.getUTCDate() + 1);
      }
    }
  } else {
    // Standard Day shift: diffDays = 0 -> 1 shift, diffDays = 1 -> 2 shifts, etc.
    const current = new Date(startCalendar);
    while (current.getTime() <= endCalendar.getTime()) {
      const shiftStart = new Date(current);
      const shiftEnd = new Date(current);

      const shiftStartTime = new Date(shiftStart);
      shiftStartTime.setUTCHours(startHours, startMinutes, startSeconds, 0);

      const shiftEndTime = new Date(shiftEnd);
      shiftEndTime.setUTCHours(endHours, endMinutes, endSeconds, 0);

      configs.push({
        startDate: shiftStart,
        endDate: shiftEnd,
        startTime: shiftStartTime,
        endTime: shiftEndTime,
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  return configs;
}

export function getShiftDates(startDateValue: string, endDateValue?: string) {
  const startDate = new Date(startDateValue);
  if (Number.isNaN(startDate.getTime())) {
    throw new BadRequestException('Invalid start_date value');
  }

  const endDate = endDateValue ? new Date(endDateValue) : startDate;
  if (Number.isNaN(endDate.getTime())) {
    throw new BadRequestException('Invalid end_date value');
  }

  if (endDate.getTime() < startDate.getTime()) {
    throw new BadRequestException(
      'end_date must be greater than or equal to start_date',
    );
  }

  const originalHours = startDate.getUTCHours();
  const originalMinutes = startDate.getUTCMinutes();
  const originalSeconds = startDate.getUTCSeconds();
  const originalMs = startDate.getUTCMilliseconds();

  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  currentDate.setUTCHours(0, 0, 0, 0);
  const finalDate = new Date(endDate);
  finalDate.setUTCHours(0, 0, 0, 0);

  while (currentDate.getTime() <= finalDate.getTime()) {
    const d = new Date(currentDate);
    d.setUTCHours(originalHours, originalMinutes, originalSeconds, originalMs);
    dates.push(d);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return dates;
}

export function normalizeBonusOptions(
  value: Prisma.JsonValue | null | undefined,
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((num) => !Number.isNaN(num) && num >= 0),
    ),
  ).sort((a, b) => a - b);
}

export function formatDateKey(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function calculateShiftHours(
  start_time: Date | string,
  end_time: Date | string,
): number {
  const start = new Date(start_time);
  const end = new Date(end_time);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
  const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();

  let diffMinutes = endMinutes - startMinutes;
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }

  return Math.round((diffMinutes / 60) * 10) / 10;
}

export async function createAndLogShifts(params: {
  prisma: PrismaService;
  activityLogService: ActivityLogService;
  serviceProviderId: string;
  createdByEmployeeId?: string | null;
  assignedStaffId?: string | null;
  postingTitle: string;
  shiftType: any;
  professionRole: any;
  isUrgent?: boolean;
  shiftConfigs: ShiftDateConfig[];
  facilityName?: string;
  fullAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  payRateHourly: number;
  signingBonus?: number | null;
  internalPoNumber?: string | null;
  emergencyBonus?: number;
  notes?: string | null;
  status?: any;
  requestingUserId?: string;
  platformMargin?: number | null;
  staffHourlyRate?: number | null;
}) {
  const created = await params.prisma.$transaction(
    params.shiftConfigs.map((config) =>
      params.prisma.shift.create({
        data: {
          service_provider_id: params.serviceProviderId,
          created_by_employee_id: params.createdByEmployeeId ?? undefined,
          assigned_staff_id: params.assignedStaffId ?? null,
          posting_title: params.postingTitle,
          shift_type: params.shiftType,
          profession_role: params.professionRole,
          is_urgent: params.isUrgent ?? false,
          start_date: config.startDate,
          end_date: config.endDate,
          start_time: config.startTime,
          end_time: config.endTime,
          facility_name: params.facilityName ?? '',
          full_address: params.fullAddress ?? '',
          latitude: params.latitude ?? null,
          longitude: params.longitude ?? null,
          pay_rate_hourly: params.payRateHourly,
          signing_bonus: params.signingBonus ?? null,
          internal_po_number: params.internalPoNumber ?? null,
          emergency_bonus: params.emergencyBonus ?? 0,
          platform_margin: params.platformMargin ?? 0,
          staff_hourly_rate: params.staffHourlyRate ?? 0,
          notes: params.notes ?? null,
          status: params.status ?? ShiftStatus.published,
        },
        select: {
          id: true,
          posting_title: true,
          shift_type: true,
          profession_role: true,
          start_date: true,
          end_date: true,
          start_time: true,
          end_time: true,
          facility_name: true,
          status: true,
          created_at: true,
        },
      }),
    ),
  );

  await Promise.all(
    created.map((c) =>
      params.activityLogService.logShiftCreate(
        params.requestingUserId ?? '',
        c.id,
        params.postingTitle,
        params.facilityName ?? '',
        params.emergencyBonus ?? 0,
      ),
    ),
  );

  return created;
}
