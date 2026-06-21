import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Prisma, ShiftStatus } from '@prisma/client';
import { CreateApplyShiftDto } from './dto/create-apply-shift.dto';
import { UpdateApplyShiftDto } from './dto/update-apply-shift.dto';
import { DateHelper } from '../../../../common/helper/date.helper';
import { DistanceHelper } from '../../../../common/helper/distance.helper';
import { ActivityLogService } from '../../../../common/service/activity-log.service';
import { PushNotificationService } from '../../../../common/service/push-notification.service';
import { NotificationRepository } from '../../../../common/repository/notification/notification.repository';

@Injectable()
export class ApplyShiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async create(createApplyShiftDto: CreateApplyShiftDto, user_id: string) {
    try {
      const { shift_id, notes } = createApplyShiftDto;

      // Validate shift_id
      if (!shift_id) {
        throw new BadRequestException('Shift ID is required');
      }

      // Get staff profile from user_id
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { user_id },
        select: {
          id: true,
          user_id: true,
          profile_completion: true,
          can_apply_to_shifts: true,
          roles: true,
        },
      });

      if (!staffProfile) {
        throw new BadRequestException(
          'Staff profile not found. Please complete your profile first.',
        );
      }

      if (staffProfile.can_apply_to_shifts === false) {
        throw new BadRequestException(
          'Your account is currently blocked from applying to shifts. Please contact support for assistance.',
        );
      }

      if ((staffProfile.profile_completion ?? 0) < 90) {
        throw new BadRequestException(
          'You must complete at least 90% of your profile before applying to shifts.',
        );
      }

      const staff_id = staffProfile.id;

      // Check if shift exists and is in a valid status for application
      const shift = await this.prisma.shift.findUnique({
        where: { id: shift_id },
        select: {
          id: true,
          status: true,
          assigned_staff_id: true,
          posting_title: true,
          facility_name: true,
          profession_role: true,
          service_provider_info: {
            select: {
              user_id: true,
            },
          },
        },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      // Validate roles
      const staffRoles = staffProfile.roles || [];
      const shiftRole = shift.profession_role;

      const hasNurseRole = staffRoles.includes('nurse');
      const hasHcaCarerRole = staffRoles.some((r) =>
        ['hca_carer', 'senior_hca', 'support_worker'].includes(r),
      );

      if (shiftRole === 'nurse') {
        if (!hasNurseRole) {
          throw new BadRequestException(
            'HCA/Carer staff cannot apply to a Nurse shift.',
          );
        }
      } else if (
        ['hca_carer', 'senior_hca', 'support_worker'].includes(shiftRole)
      ) {
        if (hasNurseRole && !hasHcaCarerRole) {
          throw new BadRequestException(
            'Nurses cannot apply for HCA/Carer shifts.',
          );
        }
        if (!hasHcaCarerRole) {
          throw new BadRequestException(
            'Only HCA/Carer staff can apply for HCA/Carer shifts.',
          );
        }
      }

      // Validate shift status - only published shifts can be applied to
      if (shift.status !== 'published') {
        throw new BadRequestException(
          `Cannot apply to shift with status: ${shift.status}. Only published shifts can be applied to.`,
        );
      }

      // Check if shift is already assigned
      if (shift.assigned_staff_id) {
        throw new BadRequestException(
          'This shift has already been assigned to another staff member.',
        );
      }

      // Check if staff has already applied to this shift
      const existingApplication = await this.prisma.shiftApplication.findUnique(
        {
          where: {
            shift_id_staff_id: {
              shift_id,
              staff_id,
            },
          },
        },
      );

      let application;

      if (existingApplication) {
        // Check application status
        if (existingApplication.status === 'pending') {
          throw new BadRequestException(
            'You have already applied to this shift. Your application is pending review.',
          );
        } else if (existingApplication.status === 'accepted') {
          throw new BadRequestException(
            'You have already been accepted for this shift.',
          );
        } else if (existingApplication.status === 'rejected') {
          throw new BadRequestException(
            'Your application for this shift was rejected. You cannot re-apply to a rejected shift.',
          );
        } else if (existingApplication.status === 'cancelled') {
          // Update the cancelled application to pending (re-apply)
          application = await this.prisma.shiftApplication.update({
            where: {
              id: existingApplication.id,
            },
            data: {
              status: 'pending',
              notes: notes || null,
              reviewed_at: null, // Clear reviewed_at
            },
            include: {
              shift: {
                select: {
                  id: true,
                  posting_title: true,
                  facility_name: true,
                  start_date: true,
                  end_date: true,
                  start_time: true,
                  end_time: true,
                  status: true,
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
        }
      } else {
        // Create a new application
        application = await this.prisma.shiftApplication.create({
          data: {
            shift_id,
            staff_id,
            status: 'pending',
            notes: notes || null,
          },
          include: {
            shift: {
              select: {
                id: true,
                posting_title: true,
                facility_name: true,
                start_date: true,
                end_date: true,
                start_time: true,
                end_time: true,
                status: true,
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
      }

      // Send push notification to service provider
      const serviceProviderUserId = shift.service_provider_info?.user_id;
      if (serviceProviderUserId) {
        const staffName =
          application.staff.first_name + ' ' + application.staff.last_name;

        await NotificationRepository.createNotification({
          receiver_id: serviceProviderUserId,
          text: `${staffName} has applied for shift: ${shift.posting_title} at ${shift.facility_name}`,
          type: 'shift_application',
          entity_id: shift_id,
        });

        await this.pushNotificationService.sendToUser(serviceProviderUserId, {
          title: 'New Shift Application',
          body: `${staffName} has applied for shift: ${shift.posting_title}`,
          data: {
            type: 'shift_application',
            shiftId: shift_id,
            applicationId: application.id,
          },
        });
      }

      return {
        success: true,
        message: 'Shift application submitted successfully',
        data: application,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to apply for shift');
    }
  }

  async findAll({
    user_id,
    page = 1,
    limit = 10,
    search = '',
    staff_latitude,
    staff_longitude,
    status,
    max_distance_miles,
    max_distance_km,
  }: {
    user_id: string;
    page?: string | number;
    limit?: string | number;
    search?: string;
    staff_latitude?: string | number;
    staff_longitude?: string | number;
    status?: string;
    max_distance_miles?: string | number;
    max_distance_km?: string | number;
  }) {
    try {
      const staff_id = await this.resolveStaffIdByUserId(user_id);

      const currentPage = Math.max(Number(page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
      if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
        throw new BadRequestException('Invalid pagination parameters');
      }
      const skip = (currentPage - 1) * pageSize;

      const { lat: staffLat, lng: staffLng } = this.parseAndValidateCoordinates(
        staff_latitude,
        staff_longitude,
      );

      const { maxDistanceMiles, maxDistanceKm } =
        this.parseAndValidateDistanceFilters(
          max_distance_miles,
          max_distance_km,
        );

      if (
        (maxDistanceMiles !== undefined || maxDistanceKm !== undefined) &&
        (staffLat === undefined || staffLng === undefined)
      ) {
        throw new BadRequestException(
          'staff_latitude and staff_longitude are required when using distance filters',
        );
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Build filter: show published shifts OR shifts assigned to this staff member
      const shiftFilterConditions: Prisma.ShiftWhereInput[] = [
        { status: 'published' },
        { assigned_staff_id: staff_id },
      ];

      const andConditions: Prisma.ShiftWhereInput[] = [
        {
          OR: shiftFilterConditions,
        },
        {
          start_date: { gte: todayStart },
        },
      ];

      if (search) {
        andConditions.push({
          OR: [
            {
              posting_title: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
            {
              facility_name: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
            {
              full_address: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
          ],
        });
      }

      if (status) {
        const validStatuses: ShiftStatus[] = [
          'draft',
          'published',
          'assigned',
          'completed',
          'cancelled',
        ];
        if (validStatuses.includes(status as ShiftStatus)) {
          andConditions.push({
            status: status as ShiftStatus,
          });
        }
      }

      const where: Prisma.ShiftWhereInput =
        andConditions.length === 1 ? andConditions[0] : { AND: andConditions };

      const [total, itemsRaw] = await this.prisma.$transaction([
        this.prisma.shift.count({ where }),
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
            facility_name: true,
            full_address: true,
            latitude: true,
            longitude: true,
            pay_rate_hourly: true,
            platform_margin: true,
            signing_bonus: true,
            emergency_bonus: true,
            status: true,
            assigned_staff_id: true,
            created_at: true,
            service_provider_info: {
              select: {
                id: true,
                organization_name: true,
              },
            },
            attendance: {
              select: {
                id: true,
                status: true,
                check_in_time: true,
                check_out_time: true,
              },
            },
            timesheet: {
              select: {
                id: true,
                status: true,
                total_hours: true,
                total_pay: true,
                staff_total_pay: true,
                staff_hourly_rate: true,
                verification_method: true,
              },
            },
            applications: {
              where: { staff_id },
              select: {
                id: true,
                status: true,
                applied_at: true,
              },
              take: 1,
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      const itemsWithDistance = await Promise.all(
        itemsRaw.map(async (shift) => {
          const { applications, ...rest } = shift as any;

          const distanceData = await DistanceHelper.calculateDistance({
            staff_latitude: staffLat,
            staff_longitude: staffLng,
            shift_latitude: rest.latitude,
            shift_longitude: rest.longitude,
          });

          const publishedAgo = rest.created_at
            ? DateHelper.getTimeAgo(new Date(rest.created_at))
            : null;

          if (rest.timesheet) {
            const staffTotalPay =
              rest.timesheet.staff_total_pay ?? rest.timesheet.total_pay ?? 0;
            rest.timesheet = {
              ...rest.timesheet,
              total_pay: staffTotalPay,
            };
          }

          return {
            ...rest,
            has_applied: applications && applications.length > 0,
            application:
              applications && applications.length > 0 ? applications[0] : null,
            published_ago: publishedAgo,
            ...distanceData,
          };
        }),
      );

      let items = itemsWithDistance;
      let filteredTotal = total;

      if (maxDistanceMiles !== undefined || maxDistanceKm !== undefined) {
        items = itemsWithDistance.filter((item) => {
          if (
            maxDistanceMiles !== undefined &&
            item.distance_miles !== undefined
          ) {
            return item.distance_miles <= maxDistanceMiles;
          }
          if (maxDistanceKm !== undefined && item.distance_km !== undefined) {
            return item.distance_km <= maxDistanceKm;
          }
          return false;
        });
        filteredTotal = items.length;
      }

      return {
        success: true,
        message: 'Shifts fetched successfully',
        data: items,
        meta: {
          total: filteredTotal,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(filteredTotal / pageSize) || 1,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to fetch shifts');
    }
  }

  async findOne(
    id: string,
    user_id: string,
    staff_latitude?: string | number,
    staff_longitude?: string | number,
  ) {
    try {
      const staff_id = await this.resolveStaffIdByUserId(user_id);
      const { lat: staffLat, lng: staffLng } = this.parseAndValidateCoordinates(
        staff_latitude,
        staff_longitude,
      );

      const shift = await this.prisma.shift.findUnique({
        where: { id },
        include: {
          service_provider_info: {
            select: {
              id: true,
              organization_name: true,
              first_name: true,
              last_name: true,
              mobile_code: true,
              mobile_number: true,
              brand_logo_url: true,
              website: true,
            },
          },
          applications: staff_id
            ? {
                where: { staff_id },
                select: {
                  id: true,
                  status: true,
                  applied_at: true,
                  notes: true,
                },
                take: 1,
              }
            : {
                select: {
                  id: true,
                  staff_id: true,
                  status: true,
                  applied_at: true,
                },
                orderBy: { applied_at: 'desc' },
              },
        },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      // Calculate distance if staff coordinates provided
      const distanceData = await DistanceHelper.calculateDistance({
        staff_latitude: staffLat,
        staff_longitude: staffLng,
        shift_latitude: shift.latitude,
        shift_longitude: shift.longitude,
      });

      // Calculate published ago
      const publishedAgo = shift.created_at
        ? DateHelper.getTimeAgo(new Date(shift.created_at))
        : null;

      // Format applications
      let has_applied = false;
      let application = null;
      const applications_list = Array.isArray(shift.applications)
        ? shift.applications
        : [];

      if (staff_id) {
        has_applied = applications_list.length > 0;
        application =
          applications_list.length > 0 ? applications_list[0] : null;
      }

      return {
        success: true,
        message: 'Shift fetched successfully',
        data: {
          ...shift,
          published_ago: publishedAgo,
          has_applied,
          application: application,
          applications: staff_id ? undefined : applications_list,
          ...distanceData,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch shift');
    }
  }

  private async resolveStaffIdByUserId(user_id: string): Promise<string> {
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { user_id },
      select: { id: true },
    });

    if (!staffProfile) {
      throw new BadRequestException(
        'Staff profile not found. Please complete your profile first.',
      );
    }

    return staffProfile.id;
  }

  private parseAndValidateCoordinates(
    staff_latitude?: string | number,
    staff_longitude?: string | number,
  ): { lat?: number; lng?: number } {
    if (staff_latitude === undefined && staff_longitude === undefined) {
      return {};
    }

    if (staff_latitude === undefined || staff_longitude === undefined) {
      throw new BadRequestException(
        'Both staff_latitude and staff_longitude must be provided together',
      );
    }

    const lat = Number(staff_latitude);
    const lng = Number(staff_longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new BadRequestException(
        'Invalid coordinates. Must be valid numbers',
      );
    }

    if (lat < -90 || lat > 90) {
      throw new BadRequestException(
        'Invalid latitude. Must be between -90 and 90',
      );
    }

    if (lng < -180 || lng > 180) {
      throw new BadRequestException(
        'Invalid longitude. Must be between -180 and 180',
      );
    }

    return { lat, lng };
  }

  private parseAndValidateDistanceFilters(
    max_distance_miles?: string | number,
    max_distance_km?: string | number,
  ): { maxDistanceMiles?: number; maxDistanceKm?: number } {
    let maxDistanceMiles: number | undefined;
    let maxDistanceKm: number | undefined;

    if (max_distance_miles !== undefined) {
      maxDistanceMiles = Number(max_distance_miles);
      if (Number.isNaN(maxDistanceMiles) || maxDistanceMiles < 0) {
        throw new BadRequestException(
          'max_distance_miles must be a valid positive number',
        );
      }
    }

    if (max_distance_km !== undefined) {
      maxDistanceKm = Number(max_distance_km);
      if (Number.isNaN(maxDistanceKm) || maxDistanceKm < 0) {
        throw new BadRequestException(
          'max_distance_km must be a valid positive number',
        );
      }
    }

    return { maxDistanceMiles, maxDistanceKm };
  }

  update(id: string, updateApplyShiftDto: UpdateApplyShiftDto) {
    return `This action updates a #${id} applyShift`;
  }

  remove(id: string) {
    return `This action removes a #${id} applyShift`;
  }
}
