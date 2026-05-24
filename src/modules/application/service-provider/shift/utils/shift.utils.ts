import { BadRequestException } from '@nestjs/common';
import { Prisma, ShiftStatus } from '@prisma/client';
import { ActivityLogService } from 'src/common/service/activity-log.service';
import { PrismaService } from 'src/prisma/prisma.service';

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

	const dates: Date[] = [];
	const currentDate = new Date(startDate);
	currentDate.setHours(0, 0, 0, 0);
	const finalDate = new Date(endDate);
	finalDate.setHours(0, 0, 0, 0);

	while (currentDate.getTime() <= finalDate.getTime()) {
		dates.push(new Date(currentDate));
		currentDate.setDate(currentDate.getDate() + 1);
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

	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');

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
	shiftDates: Date[];
	startTimeValue: string | Date;
	endTimeValue: string | Date;
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
}) {
	const created = await params.prisma.$transaction(
		params.shiftDates.map((shiftDate) =>
			params.prisma.shift.create({
				data: {
					service_provider_id: params.serviceProviderId,
					created_by_employee_id: params.createdByEmployeeId ?? undefined,
					assigned_staff_id: params.assignedStaffId ?? null,
					posting_title: params.postingTitle,
					shift_type: params.shiftType,
					profession_role: params.professionRole,
					is_urgent: params.isUrgent ?? false,
					start_date: shiftDate,
					end_date: shiftDate,
					start_time: new Date(params.startTimeValue),
					end_time: new Date(params.endTimeValue),
					facility_name: params.facilityName,
					full_address: params.fullAddress ?? null,
					latitude: params.latitude ?? null,
					longitude: params.longitude ?? null,
					pay_rate_hourly: params.payRateHourly,
					signing_bonus: params.signingBonus ?? null,
					internal_po_number: params.internalPoNumber ?? null,
					emergency_bonus: params.emergencyBonus ?? 0,
					notes: params.notes ?? null,
					status: params.status ?? ShiftStatus.published,
				},
				select: {
					id: true,
					posting_title: true,
					shift_type: true,
					profession_role: true,
					start_date: true,
					start_time: true,
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
				params.facilityName,
				params.emergencyBonus ?? 0,
			),
		),
	);

	return created;
}

