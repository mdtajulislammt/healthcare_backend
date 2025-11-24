import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ShiftStatus, ShiftAttendanceStatus, TimesheetStatus } from '@prisma/client';
import { DateHelper } from 'src/common/helper/date.helper';
import { DistanceHelper } from 'src/common/helper/distance.helper';

@Injectable()
export class HomeService {
    constructor(private readonly prisma: PrismaService) { }

    async getDashboardData(staffUserId: string) {
        try {
            // Get staff profile
            const staffProfile = await this.prisma.staffProfile.findUnique({
                where: { user_id: staffUserId },
                select: {
                    id: true,
                    profile_completion: true,
                },
            });

            if (!staffProfile) {
                throw new NotFoundException('Staff profile not found');
            }

            const staffId = staffProfile.id;
            const now = new Date();

            // Get next confirmed shift (assigned, not completed, start_date >= today)
            const nextShift = await this.prisma.shift.findFirst({
                where: {
                    assigned_staff_id: staffId,
                    status: ShiftStatus.assigned,
                    start_date: {
                        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                    },
                },
                select: {
                    id: true,
                    posting_title: true,
                    facility_name: true,
                    start_date: true,
                    start_time: true,
                    end_time: true,
                    profession_role: true,
                },
                orderBy: {
                    start_date: 'asc',
                },
            });

            // Get immediate check-in needed shift (assigned, today, not checked in)
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

            const immediateCheckInShift = await this.prisma.shift.findFirst({
                where: {
                    assigned_staff_id: staffId,
                    status: ShiftStatus.assigned,
                    start_date: {
                        gte: todayStart,
                        lte: todayEnd,
                    },
                    attendance: {
                        OR: [
                            { status: ShiftAttendanceStatus.not_checked_in },
                            { status: ShiftAttendanceStatus.checked_in },
                        ],
                    },
                },
                select: {
                    id: true,
                    facility_name: true,
                    profession_role: true,
                    start_date: true,
                    start_time: true,
                    end_time: true,
                    attendance: {
                        select: {
                            status: true,
                            check_in_time: true,
                        },
                    },
                },
                orderBy: {
                    start_time: 'asc',
                },
            });

            // Get work statistics
            const [shiftsCompleted, timesheets] = await this.prisma.$transaction([
                // Count completed shifts
                this.prisma.shift.count({
                    where: {
                        assigned_staff_id: staffId,
                        status: ShiftStatus.completed,
                    },
                }),
                // Get all approved/paid timesheets for calculations
                this.prisma.shiftTimesheet.findMany({
                    where: {
                        staff_id: staffId,
                        status: {
                            in: [TimesheetStatus.approved, TimesheetStatus.paid],
                        },
                        total_hours: { not: null },
                        total_pay: { not: null },
                    },
                    select: {
                        total_hours: true,
                        hourly_rate: true,
                        total_pay: true,
                    },
                }),
            ]);

            // Calculate statistics
            const totalHours = timesheets.reduce((sum, t) => sum + (t.total_hours || 0), 0);
            const totalIncome = timesheets.reduce((sum, t) => sum + (t.total_pay || 0), 0);
            const avgHourlyRate =
                timesheets.length > 0
                    ? timesheets.reduce((sum, t) => sum + (t.hourly_rate || 0), 0) / timesheets.length
                    : 0;

            // Format next shift
            let formattedNextShift = null;
            if (nextShift) {
                const startDate = new Date(nextShift.start_date);
                const startTime = new Date(nextShift.start_time);
                const endTime = new Date(nextShift.end_time);

                formattedNextShift = {
                    id: nextShift.id,
                    date: startDate.toISOString().split('T')[0],
                    facility: nextShift.facility_name,
                    time: `${startTime.toTimeString().slice(0, 5)} - ${endTime.toTimeString().slice(0, 5)}`,
                    role: nextShift.profession_role,
                };
            }

            // Format immediate check-in shift
            let formattedImmediateCheckIn = null;
            if (immediateCheckInShift) {
                const startDate = new Date(immediateCheckInShift.start_date);
                const startTime = new Date(immediateCheckInShift.start_time);
                const endTime = new Date(immediateCheckInShift.end_time);

                formattedImmediateCheckIn = {
                    id: immediateCheckInShift.id,
                    facility: immediateCheckInShift.facility_name,
                    role: immediateCheckInShift.profession_role,
                    date: startDate.toISOString().split('T')[0],
                    time: `${startTime.toTimeString().slice(0, 5)} - ${endTime.toTimeString().slice(0, 5)}`,
                    canCheckIn: immediateCheckInShift.attendance?.status === ShiftAttendanceStatus.not_checked_in,
                };
            }

            return {
                success: true,
                message: 'Dashboard data fetched successfully',
                data: {
                    profileCompletion: {
                        percentage: staffProfile.profile_completion || 0,
                        message: 'Complete your profile to unlock shifts!',
                    },
                    nextShift: formattedNextShift,
                    workStatistics: {
                        shiftsCompleted,
                        totalHoursWorked: Math.round(totalHours * 10) / 10,
                        avgHourlyRate: Math.round(avgHourlyRate * 100) / 100,
                        totalIncome: Math.round(totalIncome * 100) / 100,
                    },
                    immediateCheckIn: formattedImmediateCheckIn,
                },
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch dashboard data',
            );
        }
    }

    async getNewShiftsNearYou(
        staffUserId: string,
        latitude?: number,
        longitude?: number,
        limit: number = 10,
    ) {
        try {
            // Get staff profile
            const staffProfile = await this.prisma.staffProfile.findUnique({
                where: { user_id: staffUserId },
                select: {
                    id: true,
                },
            });

            if (!staffProfile) {
                throw new NotFoundException('Staff profile not found');
            }

            const staffId = staffProfile.id;
            const staffLat = latitude;
            const staffLng = longitude;

            // Get published shifts that staff hasn't applied to
            const now = new Date();
            const shifts = await this.prisma.shift.findMany({
                where: {
                    status: ShiftStatus.published,
                    start_date: {
                        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                    },
                    applications: {
                        none: {
                            staff_id: staffId,
                        },
                    },
                },
                select: {
                    id: true,
                    posting_title: true,
                    facility_name: true,
                    start_date: true,
                    start_time: true,
                    end_time: true,
                    latitude: true,
                    longitude: true,
                    profession_role: true,
                    created_at: true,
                    service_provider_info: {
                        select: {
                            organization_name: true,
                        },
                    },
                },
                orderBy: {
                    created_at: 'desc',
                },
                take: limit,
            });

            // Calculate distance and format shifts
            const formattedShifts = await Promise.all(
                shifts.map(async (shift) => {
                    // Calculate distance
                    let distanceMiles: number | undefined = undefined;
                    if (staffLat && staffLng && shift.latitude && shift.longitude) {
                        const distanceData = await DistanceHelper.calculateDistance({
                            staff_latitude: staffLat,
                            staff_longitude: staffLng,
                            shift_latitude: shift.latitude,
                            shift_longitude: shift.longitude,
                        });
                        distanceMiles = distanceData.distance_miles;
                    }

                    // Calculate time ago
                    const publishedAgo = shift.created_at
                        ? DateHelper.getTimeAgo(new Date(shift.created_at))
                        : null;

                    // Format dates
                    const startDate = new Date(shift.start_date);
                    const startTime = new Date(shift.start_time);
                    const endTime = new Date(shift.end_time);

                    // Calculate estimated shift duration in hours
                    const durationMs = endTime.getTime() - startTime.getTime();
                    const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10;

                    return {
                        id: shift.id,
                        facilityName: shift.facility_name,
                        postedAgo: publishedAgo,
                        date: startDate.toISOString().split('T')[0],
                        time: `${startTime.toTimeString().slice(0, 5)} - ${endTime.toTimeString().slice(0, 5)}`,
                        distance: distanceMiles ? `${Math.round(distanceMiles * 10) / 10} miles` : null,
                        estimatedDuration: `(estimated ${durationHours}-hour shift)`,
                        role: shift.profession_role,
                    };
                }),
            );

            return {
                success: true,
                message: 'New shifts near you fetched successfully',
                data: formattedShifts,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch new shifts',
            );
        }
    }

    async getAllHomeData(
        staffUserId: string,
        latitude?: number,
        longitude?: number,
        limit: number = 10,
    ) {
        try {
            // Fetch both dashboard and new shifts in parallel
            const [dashboardData, newShiftsData] = await Promise.all([
                this.getDashboardData(staffUserId),
                this.getNewShiftsNearYou(staffUserId, latitude, longitude, limit),
            ]);

            return {
                success: true,
                message: 'Home data fetched successfully',
                data: {
                    dashboard: dashboardData.data,
                    newShifts: newShiftsData.data,
                },
            };
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'Failed to fetch home data',
            );
        }
    }
}
