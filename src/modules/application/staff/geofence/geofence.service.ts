import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { DistanceHelper } from '../../../../common/helper/distance.helper';
import { NotificationRepository } from '../../../../common/repository/notification/notification.repository';
import { TimesheetStatus, ShiftAttendanceStatus } from '@prisma/client';
import { ActivityLogService } from '../../../../common/service/activity-log.service';

@Injectable()
export class GeofenceService {
    private readonly GEOFENCE_RADIUS_METERS = 100; // 100 meters threshold

    constructor(
        private readonly prisma: PrismaService,
        private readonly activityLogService: ActivityLogService,
    ) { }

    async checkGeofence(
        shiftId: string,
        staffUserId: string,
        latitude: number,
        longitude: number,
    ) {
        try {
            // Get staff profile from user_id
            const staffProfile = await this.prisma.staffProfile.findUnique({
                where: { user_id: staffUserId },
                select: { id: true, user_id: true },
            });

            if (!staffProfile) {
                throw new BadRequestException(
                    'Staff profile not found. Please complete your profile first.',
                );
            }

            const staff_id = staffProfile.id;

            // Get shift with location and assigned staff
            const shift = await this.prisma.shift.findUnique({
                where: { id: shiftId },
                select: {
                    id: true,
                    assigned_staff_id: true,
                    latitude: true,
                    longitude: true,
                    facility_name: true,
                    full_address: true,
                    posting_title: true,
                },
            });

            if (!shift) {
                throw new NotFoundException('Shift not found');
            }

            // Verify staff is assigned to this shift
            if (shift.assigned_staff_id !== staff_id) {
                throw new ForbiddenException(
                    'You are not assigned to this shift. Only assigned staff can check geofence.',
                );
            }

            // Check if shift has location coordinates
            if (shift.latitude === null || shift.longitude === null) {
                throw new BadRequestException(
                    'Shift location coordinates are not available. Cannot check geofence.',
                );
            }

            // Calculate distance between staff location and shift location
            const distanceResult = await DistanceHelper.calculateDistance({
                staff_latitude: latitude,
                staff_longitude: longitude,
                shift_latitude: shift.latitude,
                shift_longitude: shift.longitude,
            });

            // Check if distance calculation was successful
            if (
                distanceResult.distance_meters === undefined ||
                distanceResult.distance_meters === null
            ) {
                throw new InternalServerErrorException(
                    'Failed to calculate distance. Please try again.',
                );
            }

            const distanceMeters = distanceResult.distance_meters;
            const isWithinGeofence = distanceMeters <= this.GEOFENCE_RADIUS_METERS;

            // Check if geofence has already been verified
            // We check if ShiftTimesheet exists with geofence verification
            const existingTimesheet = await this.prisma.shiftTimesheet.findUnique({
                where: { shift_id: shiftId },
                select: {
                    id: true,
                    verification_method: true,
                    clock_in_verified: true,
                },
            });

            // Check if attendance already exists
            const existingAttendance = await this.prisma.shiftAttendance.findUnique({
                where: { shift_id: shiftId },
                select: {
                    id: true,
                    status: true,
                    check_in_time: true,
                },
            });

            const geofenceAlreadyVerified =
                existingTimesheet?.verification_method === 'Geofence Verified';

            const alreadyCheckedIn =
                existingAttendance?.status === ShiftAttendanceStatus.checked_in ||
                existingAttendance?.status === ShiftAttendanceStatus.checked_out;

            let notificationSent = false;
            let timesheetUpdated = false;
            let attendanceCreated = false;

            // If within geofence and not yet verified, automatically verify geofence and enable check-in
            if (isWithinGeofence && !geofenceAlreadyVerified) {
                // Use transaction to ensure atomicity
                await this.prisma.$transaction(async (tx) => {
                    // Create or update ShiftTimesheet with geofence verification
                    // clock_in_verified remains false - service provider will verify later
                    await tx.shiftTimesheet.upsert({
                        where: { shift_id: shiftId },
                        create: {
                            shift_id: shiftId,
                            staff_id: staff_id,
                            verification_method: 'Geofence Verified',
                            clock_in_verified: false, // Service provider will verify
                            status: TimesheetStatus.pending_submission,
                        },
                        update: {
                            verification_method: 'Geofence Verified',
                            // Don't update clock_in_verified - keep existing value
                        },
                    });

                    timesheetUpdated = true;

                    // Create or update ShiftAttendance - staff can now check in
                    // Only create if not already checked in
                    if (!alreadyCheckedIn) {
                        await tx.shiftAttendance.upsert({
                            where: { shift_id: shiftId },
                            create: {
                                shift_id: shiftId,
                                staff_id: staff_id,
                                status: ShiftAttendanceStatus.not_checked_in,
                                location_check: 'Geofence Verified',
                            },
                            update: {
                                location_check: 'Geofence Verified',
                            },
                        });

                        attendanceCreated = true;
                    }

                    // Create notification for check-in
                    await NotificationRepository.createNotification({
                        receiver_id: staffUserId,
                        text: 'Geofence verified! You can now check in.',
                        type: 'booking',
                        entity_id: shiftId,
                    });

                    notificationSent = true;
                });
            }

            return {
                success: true,
                message: 'Geofence check completed successfully',
                data: {
                    is_within_geofence: isWithinGeofence,
                    distance_meters: Math.round(distanceMeters),
                    distance_km: distanceResult.distance_km
                        ? Math.round(distanceResult.distance_km * 10) / 10
                        : null,
                    geofence_radius_meters: this.GEOFENCE_RADIUS_METERS,
                    notification_sent: notificationSent,
                    geofence_verified: geofenceAlreadyVerified || timesheetUpdated,
                    can_check_in: (geofenceAlreadyVerified || timesheetUpdated) && !alreadyCheckedIn,
                    attendance_created: attendanceCreated,
                    shift: {
                        id: shift.id,
                        posting_title: shift.posting_title,
                        facility_name: shift.facility_name,
                        full_address: shift.full_address,
                    },
                },
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ForbiddenException
            ) {
                throw error;
            }
            throw new InternalServerErrorException(
                'Failed to check geofence. Please try again.',
            );
        }
    }

    async checkIn(shiftId: string, staffUserId: string) {
        try {
            // Get staff profile from user_id
            const staffProfile = await this.prisma.staffProfile.findUnique({
                where: { user_id: staffUserId },
                select: { id: true, user_id: true },
            });

            if (!staffProfile) {
                throw new BadRequestException(
                    'Staff profile not found. Please complete your profile first.',
                );
            }

            const staff_id = staffProfile.id;

            // Get shift with assigned staff
            const shift = await this.prisma.shift.findUnique({
                where: { id: shiftId },
                select: {
                    id: true,
                    assigned_staff_id: true,
                    posting_title: true,
                    facility_name: true,
                },
            });

            if (!shift) {
                throw new NotFoundException('Shift not found');
            }

            // Verify staff is assigned to this shift
            if (shift.assigned_staff_id !== staff_id) {
                throw new ForbiddenException(
                    'You are not assigned to this shift. Only assigned staff can check in.',
                );
            }

            // Check if geofence is verified
            const timesheet = await this.prisma.shiftTimesheet.findUnique({
                where: { shift_id: shiftId },
                select: {
                    id: true,
                    verification_method: true,
                },
            });

            if (!timesheet || timesheet.verification_method !== 'Geofence Verified') {
                throw new BadRequestException(
                    'Geofence must be verified before checking in. Please verify your location first.',
                );
            }

            // Check if already checked in
            const existingAttendance = await this.prisma.shiftAttendance.findUnique({
                where: { shift_id: shiftId },
                select: {
                    id: true,
                    status: true,
                    check_in_time: true,
                },
            });

            if (
                existingAttendance?.status === ShiftAttendanceStatus.checked_in ||
                existingAttendance?.status === ShiftAttendanceStatus.checked_out
            ) {
                throw new BadRequestException('You have already checked in for this shift.');
            }

            // Create or update ShiftAttendance with check-in
            const checkInTime = new Date();
            const attendance = await this.prisma.shiftAttendance.upsert({
                where: { shift_id: shiftId },
                create: {
                    shift_id: shiftId,
                    staff_id: staff_id,
                    status: ShiftAttendanceStatus.checked_in,
                    check_in_time: checkInTime,
                    location_check: 'Geofence Verified',
                },
                update: {
                    status: ShiftAttendanceStatus.checked_in,
                    check_in_time: checkInTime,
                },
            });

            // Automatically verify clock-in
            await this.prisma.shiftTimesheet.upsert({
                where: { shift_id: shiftId },
                create: {
                    shift_id: shiftId,
                    staff_id: staff_id,
                    verification_method: 'Geofence Verified',
                    clock_in_verified: true,
                    status: TimesheetStatus.pending_submission,
                },
                update: {
                    clock_in_verified: true,
                },
            });

            // Log activity
            await this.activityLogService.logShiftCheckIn(
                staffUserId,
                shiftId,
                shift.facility_name,
            );

            return {
                success: true,
                message: 'Check-in completed successfully',
                data: {
                    attendance: {
                        id: attendance.id,
                        status: attendance.status,
                        check_in_time: attendance.check_in_time,
                    },
                    shift: {
                        id: shift.id,
                        posting_title: shift.posting_title,
                        facility_name: shift.facility_name,
                    },
                },
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ForbiddenException
            ) {
                throw error;
            }
            throw new InternalServerErrorException(
                'Failed to check in. Please try again.',
            );
        }
    }

    async checkOut(shiftId: string, staffUserId: string) {
        try {
            // Get staff profile from user_id
            const staffProfile = await this.prisma.staffProfile.findUnique({
                where: { user_id: staffUserId },
                select: { id: true, user_id: true },
            });

            if (!staffProfile) {
                throw new BadRequestException(
                    'Staff profile not found. Please complete your profile first.',
                );
            }

            const staff_id = staffProfile.id;

            // Get shift with assigned staff and pay rate
            const shift = await this.prisma.shift.findUnique({
                where: { id: shiftId },
                select: {
                    id: true,
                    assigned_staff_id: true,
                    posting_title: true,
                    facility_name: true,
                    pay_rate_hourly: true,
                },
            });

            if (!shift) {
                throw new NotFoundException('Shift not found');
            }

            // Verify staff is assigned to this shift
            if (shift.assigned_staff_id !== staff_id) {
                throw new ForbiddenException(
                    'You are not assigned to this shift. Only assigned staff can check out.',
                );
            }

            // Check if already checked in
            const existingAttendance = await this.prisma.shiftAttendance.findUnique({
                where: { shift_id: shiftId },
                select: {
                    id: true,
                    status: true,
                    check_in_time: true,
                    check_out_time: true,
                },
            });

            if (!existingAttendance) {
                throw new BadRequestException(
                    'You must check in before checking out. Please check in first.',
                );
            }

            if (existingAttendance.status === ShiftAttendanceStatus.checked_out) {
                throw new BadRequestException('You have already checked out for this shift.');
            }

            if (existingAttendance.status === ShiftAttendanceStatus.not_checked_in) {
                throw new BadRequestException(
                    'You must check in before checking out. Please check in first.',
                );
            }

            // Update ShiftAttendance with check-out
            const checkOutTime = new Date();
            const checkInTime = existingAttendance.check_in_time;

            if (!checkInTime) {
                throw new BadRequestException('Check-in time is missing. Cannot calculate hours.');
            }

            // Calculate total hours worked
            const timeDifferenceMs = checkOutTime.getTime() - checkInTime.getTime();
            const totalHours = parseFloat((timeDifferenceMs / (1000 * 60 * 60)).toFixed(2)); // Convert to hours with 2 decimal places

            // Get hourly rate from shift
            const hourlyRate = shift.pay_rate_hourly;

            // Calculate total pay
            const totalPay = parseFloat((totalHours * hourlyRate).toFixed(2));

            const attendance = await this.prisma.shiftAttendance.update({
                where: { shift_id: shiftId },
                data: {
                    status: ShiftAttendanceStatus.checked_out,
                    check_out_time: checkOutTime,
                },
            });

            // Automatically verify clock-out and update timesheet with calculated values
            await this.prisma.shiftTimesheet.upsert({
                where: { shift_id: shiftId },
                create: {
                    shift_id: shiftId,
                    staff_id: staff_id,
                    verification_method: 'Geofence Verified',
                    clock_out_verified: true,
                    status: TimesheetStatus.submitted,
                    total_hours: totalHours,
                    hourly_rate: hourlyRate,
                    total_pay: totalPay,
                    submitted_at: new Date(),
                },
                update: {
                    clock_out_verified: true,
                    total_hours: totalHours,
                    hourly_rate: hourlyRate,
                    total_pay: totalPay,
                    status: TimesheetStatus.submitted,
                    submitted_at: new Date(),
                },
            });

            // Log activity for checkout
            await this.activityLogService.logShiftCheckOut(
                staffUserId,
                shiftId,
                shift.facility_name,
            );

            // Log activity for timesheet submission
            const timesheet = await this.prisma.shiftTimesheet.findUnique({
                where: { shift_id: shiftId },
                select: { id: true },
            });

            if (timesheet) {
                await this.activityLogService.logTimesheetSubmit(
                    staffUserId,
                    timesheet.id,
                    shiftId,
                    totalHours,
                    totalPay,
                );
            }

            return {
                success: true,
                message: 'Check-out completed successfully',
                data: {
                    attendance: {
                        id: attendance.id,
                        status: attendance.status,
                        check_in_time: attendance.check_in_time,
                        check_out_time: attendance.check_out_time,
                    },
                    shift: {
                        id: shift.id,
                        posting_title: shift.posting_title,
                        facility_name: shift.facility_name,
                    },
                },
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ForbiddenException
            ) {
                throw error;
            }
            throw new InternalServerErrorException(
                'Failed to check out. Please try again.',
            );
        }
    }
}

