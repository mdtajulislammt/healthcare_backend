import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateShiftDto } from './dto/create-shift.dto';
import {
  Prisma,
  ProfessionRole,
  ShiftApplicationStatus,
  ShiftStatus,
} from '@prisma/client';
import { UpdateShiftDto } from './dto/update-shift.dto';
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { PrismaService } from 'src/prisma/prisma.service';
import { GoogleMapsService } from 'src/common/lib/GoogleMaps/GoogleMapsService';
import { ActivityLogService } from 'src/common/service/activity-log.service';
import { ServiceProviderContextHelper } from 'src/common/helper/service-provider-context.helper';

@Injectable()
export class ShiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly providerContextHelper: ServiceProviderContextHelper,
  ) {}

  async create(createShiftDto: CreateShiftDto, requestingUserId: string) {
    try {
      const {
        created_by_employee_id,
        assigned_staff_id,
        posting_title,
        shift_type,
        profession_role,
        is_urgent,
        start_date,
        end_date,
        start_time,
        end_time,
        facility_name,
        full_address,
        signing_bonus,
        internal_po_number,
        emergency_bonus,
        notes,
        status,
      } = createShiftDto;

      const { serviceProviderId, employeeId: requesterEmployeeId } =
        await this.providerContextHelper.resolveFromUser(requestingUserId);

      const serviceProvider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id: serviceProviderId },
        select: { id: true, emergency_bonus_increments: true },
      });
      if (!serviceProvider) {
        throw new NotFoundException('Service provider not found');
      }

      const rolePayRate = await (
        this.prisma as any
      ).providerPayRateByRole.findUnique({
        where: {
          service_provider_id_profession_role: {
            service_provider_id: serviceProviderId,
            profession_role: profession_role,
          },
        },
        select: { pay_rate_hourly: true },
      });

      const providerPayRateHourly = rolePayRate
        ? Number(rolePayRate.pay_rate_hourly)
        : null;
      if (
        providerPayRateHourly === null ||
        providerPayRateHourly === undefined ||
        Number.isNaN(providerPayRateHourly) ||
        providerPayRateHourly <= 0
      ) {
        throw new BadRequestException(
          `Admin has not set pay rate for ${profession_role} role for this service provider`,
        );
      }

      const bonusOptions = this.normalizeBonusOptions(
        serviceProvider.emergency_bonus_increments,
      );

      const selectedEmergencyBonus =
        emergency_bonus !== undefined && emergency_bonus !== null
          ? Number(emergency_bonus)
          : 0;

      if (Number.isNaN(selectedEmergencyBonus) || selectedEmergencyBonus < 0) {
        throw new BadRequestException(
          'Emergency bonus must be a non-negative number',
        );
      }

      if (
        selectedEmergencyBonus > 0 &&
        bonusOptions.length > 0 &&
        !bonusOptions.includes(selectedEmergencyBonus)
      ) {
        throw new BadRequestException(
          'Emergency bonus must match one of the allowed increments',
        );
      }

      let finalCreatorEmployeeId =
        created_by_employee_id || requesterEmployeeId || null;
      if (finalCreatorEmployeeId) {
        const creator = await this.prisma.employee.findUnique({
          where: { id: finalCreatorEmployeeId },
          select: { id: true, service_provider_id: true },
        });
        if (!creator || creator.service_provider_id !== serviceProviderId) {
          throw new BadRequestException(
            'Creator employee is invalid for this service provider',
          );
        }
        finalCreatorEmployeeId = creator.id;
      }

      if (assigned_staff_id) {
        const staff = await this.prisma.staffProfile.findUnique({
          where: { id: assigned_staff_id },
          select: { id: true },
        });
        if (!staff) {
          throw new BadRequestException('Assigned staff not found');
        }
      }

      // Geocode address to get coordinates
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (full_address) {
        try {
          const geocodeResult =
            await GoogleMapsService.geocodeAddress(full_address);
          console.log('geocodeResult', geocodeResult);
          if (geocodeResult) {
            latitude = geocodeResult.latitude;
            longitude = geocodeResult.longitude;
          }
        } catch (error) {
          // Log error but continue without coordinates
          const geocodeErrorMessage =
            error instanceof Error ? error.message : 'Unknown geocode error';
          console.error(
            'Failed to geocode address for shift:',
            geocodeErrorMessage,
          );
        }
      }

      const shiftDates = this.getShiftDates(start_date, end_date);

      const shifts = await this.prisma.$transaction(
        shiftDates.map((shiftDate) =>
          this.prisma.shift.create({
            data: {
              service_provider_id: serviceProviderId,
              created_by_employee_id: finalCreatorEmployeeId,
              assigned_staff_id,
              posting_title,
              shift_type,
              profession_role,
              is_urgent,
              start_date: shiftDate,
              end_date: shiftDate,
              start_time: new Date(start_time),
              end_time: new Date(end_time),
              facility_name,
              full_address,
              latitude,
              longitude,
              pay_rate_hourly: providerPayRateHourly,
              signing_bonus,
              internal_po_number,
              emergency_bonus: selectedEmergencyBonus,
              notes,
              status,
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
        shifts.map((shift) =>
          this.activityLogService.logShiftCreate(
            requestingUserId,
            shift.id,
            posting_title,
            facility_name,
            selectedEmergencyBonus,
          ),
        ),
      );

      return {
        success: true,
        message:
          shifts.length === 1
            ? 'Shift created successfully'
            : `${shifts.length} shifts created successfully`,
        data: shifts,
        meta: {
          total_created: shifts.length,
          start_date,
          end_date: end_date ?? start_date,
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create shift');
    }
  }

  async findAll(
    requestingUserId: string,
    {
      page = 1,
      limit = 10,
      search = '',
    }: { page?: number; limit?: number; search?: string } = {},
  ) {
    try {
      const { serviceProviderId } =
        await this.providerContextHelper.resolveFromUser(requestingUserId);

      const currentPage = Math.max(Number(page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
      if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
        throw new BadRequestException('Invalid pagination parameters');
      }
      const skip = (currentPage - 1) * pageSize;

      const searchCondition = search
        ? {
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
          }
        : undefined;

      const where: Prisma.ShiftWhereInput = {
        service_provider_id: serviceProviderId,
        ...(searchCondition ?? {}),
      };

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
            pay_rate_hourly: true,
            status: true,
            notes: true,
            created_at: true,
            assigned_staff: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                photo_url: true,
                reviews: {
                  select: { rating: true },
                },
                _count: {
                  select: { reviews: true },
                },
              },
            },
            _count: { select: { applications: true } },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      const items = itemsRaw.map((s) => {
        const avgRating = s.assigned_staff?.reviews?.length
          ? s.assigned_staff.reviews.reduce((sum, r) => sum + r.rating, 0) /
            s.assigned_staff.reviews.length
          : null;

        return {
          ...s,
          assigned_staff: s.assigned_staff
            ? {
                id: s.assigned_staff.id,
                first_name: s.assigned_staff.first_name,
                last_name: s.assigned_staff.last_name,
                avg_rating: avgRating ? Number(avgRating.toFixed(1)) : null,
                photo_url: s.assigned_staff.photo_url
                  ? SojebStorage.url(
                      appConfig().storageUrl.staff + s.assigned_staff.photo_url,
                    )
                  : null,
              }
            : null,
          review_count: s.assigned_staff?._count?.reviews ?? 0,
          applications_count: s._count?.applications ?? 0,
          _count: undefined,
        };
      });

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
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to fetch shifts');
    }
  }

  async findOne(
    id: string,
    filters: { applicationStatus?: string; dateOrder?: 'asc' | 'desc' } = {},
  ) {
    try {
      let applicationStatusFilter: ShiftApplicationStatus | undefined;
      if (filters.applicationStatus) {
        const statusKey = filters.applicationStatus.toLowerCase();
        if (statusKey !== 'all') {
          const statusMap: Record<string, ShiftApplicationStatus> = {
            new: ShiftApplicationStatus.pending,
            pending: ShiftApplicationStatus.pending,
            accepted: ShiftApplicationStatus.accepted,
            rejected: ShiftApplicationStatus.rejected,
            cancelled: ShiftApplicationStatus.cancelled,
          };
          applicationStatusFilter = statusMap[statusKey];
          if (!applicationStatusFilter) {
            throw new BadRequestException('Invalid application status filter');
          }
        }
      }
      const applicationsWhere: Prisma.ShiftApplicationWhereInput | undefined =
        applicationStatusFilter
          ? { status: applicationStatusFilter }
          : undefined;
      const requestedOrder = filters.dateOrder?.toString().toLowerCase();
      const applicationsOrder: Prisma.SortOrder =
        requestedOrder === 'asc' ? 'asc' : 'desc';

      const shift = await this.prisma.shift.findUnique({
        where: { id },
        include: {
          service_provider_info: {
            select: { id: true, organization_name: true, user_id: true },
          },
          created_by_employee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              employee_role: true,
            },
          },
          assigned_staff: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              roles: true,
              bio: true,
              photo_url: true,
              reviews: {
                select: { rating: true },
              },
            },
          },
          applications: {
            where: applicationsWhere,
            select: {
              id: true,
              status: true,
              applied_at: true,
              staff: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  mobile_code: true,
                  mobile_number: true,
                  photo_url: true,
                  nmc_pin: true,
                  roles: true,
                  right_to_work_status: true,
                  user: { select: { email: true } },
                },
              },
            },
            orderBy: { applied_at: applicationsOrder },
          },
          attendance: true,
          timesheet: true,
          reviews: {
            select: {
              id: true,
              rating: true,
              feedback: true,
              created_at: true,
            },
            orderBy: { created_at: 'desc' },
          },
          _count: { select: { applications: true } },
        },
      });

      if (!shift) throw new NotFoundException('Shift not found');

      // Get service provider preferences for all staff in applications
      const staffIds = shift.applications.map((app) => app.staff.id);
      const preferences = await this.prisma.providerStaffPreference.findMany({
        where: {
          provider_id: shift.service_provider_id,
          staff_id: { in: staffIds },
        },
        select: {
          staff_id: true,
          preference_type: true,
        },
      });

      // Create lookup maps for quick access
      const favoriteMap = new Map(
        preferences
          .filter((p) => p.preference_type === 'favorite')
          .map((p) => [p.staff_id, true]),
      );
      const blockedMap = new Map(
        preferences
          .filter((p) => p.preference_type === 'blocked')
          .map((p) => [p.staff_id, true]),
      );

      if (shift.applications && shift.applications.length) {
        for (const application of shift.applications) {
          if (application.staff.photo_url) {
            application.staff.photo_url = SojebStorage.url(
              appConfig().storageUrl.staff + application.staff.photo_url,
            );
          }
          // Add preference flags
          (application.staff as any).is_favorite =
            favoriteMap.has(application.staff.id) || false;
          (application.staff as any).is_blocked =
            blockedMap.has(application.staff.id) || false;
        }
      }

      // Format assigned staff photo URL if exists
      if (shift.assigned_staff?.photo_url) {
        shift.assigned_staff.photo_url = SojebStorage.url(
          appConfig().storageUrl.staff + shift.assigned_staff.photo_url,
        );
      }

      // Calculate average rating for assigned staff
      let assignedStaffWithRating = null;
      if (shift.assigned_staff) {
        const avgRating = shift.assigned_staff.reviews?.length
          ? shift.assigned_staff.reviews.reduce((sum, r) => sum + r.rating, 0) /
            shift.assigned_staff.reviews.length
          : null;

        assignedStaffWithRating = {
          id: shift.assigned_staff.id,
          first_name: shift.assigned_staff.first_name,
          last_name: shift.assigned_staff.last_name,
          photo_url: shift.assigned_staff.photo_url,
          bio: shift.assigned_staff.bio,
          roles: shift.assigned_staff.roles,
          avg_rating: avgRating ? Number(avgRating.toFixed(1)) : null,
        };
      }

      const { _count, assigned_staff, reviews, ...rest } = shift as any;
      const formatted = {
        ...rest,
        assigned_staff: assignedStaffWithRating,
        applications_count: _count?.applications ?? 0,
        is_reviewed: reviews && reviews.length > 0,
      };

      return {
        success: true,
        message: 'Shift fetched successfully',
        data: formatted,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch shift');
    }
  }

  async update(id: string, updateShiftDto: UpdateShiftDto) {
    try {
      const shift = await this.prisma.shift.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          service_provider_id: true,
        },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      if (shift.status !== ShiftStatus.published) {
        throw new BadRequestException('Only published shifts can be edited');
      }

      const updateData: Prisma.ShiftUpdateInput = {};

      if (updateShiftDto.created_by_employee_id !== undefined) {
        updateData.created_by_employee = updateShiftDto.created_by_employee_id
          ? {
              connect: {
                id: updateShiftDto.created_by_employee_id,
              },
            }
          : {
              disconnect: true,
            };
      }

      // if (updateShiftDto.assigned_staff_id !== undefined) {
      //   updateData.assigned_staff = updateShiftDto.assigned_staff_id
      //     ? {
      //         connect: {
      //           id: updateShiftDto.assigned_staff_id,
      //         },
      //       }
      //     : {
      //         disconnect: true,
      //       };
      // }

      if (updateShiftDto.posting_title !== undefined) {
        updateData.posting_title = updateShiftDto.posting_title;
      }

      if (updateShiftDto.shift_type !== undefined) {
        updateData.shift_type = updateShiftDto.shift_type;
      }

      if (updateShiftDto.profession_role !== undefined) {
        updateData.profession_role = updateShiftDto.profession_role;
      }

      if (updateShiftDto.is_urgent !== undefined) {
        updateData.is_urgent = updateShiftDto.is_urgent;
      }

      if (updateShiftDto.start_date !== undefined) {
        const startDate = new Date(updateShiftDto.start_date);
        if (Number.isNaN(startDate.getTime())) {
          throw new BadRequestException('Invalid start_date value');
        }
        updateData.start_date = startDate;
      }

      if (updateShiftDto.end_date !== undefined) {
        const endDate = new Date(updateShiftDto.end_date);
        if (Number.isNaN(endDate.getTime())) {
          throw new BadRequestException('Invalid end_date value');
        }
        updateData.end_date = endDate;
      }

      if (updateShiftDto.start_time !== undefined) {
        const startTime = new Date(updateShiftDto.start_time);
        if (Number.isNaN(startTime.getTime())) {
          throw new BadRequestException('Invalid start_time value');
        }
        updateData.start_time = startTime;
      }

      if (updateShiftDto.end_time !== undefined) {
        const endTime = new Date(updateShiftDto.end_time);
        if (Number.isNaN(endTime.getTime())) {
          throw new BadRequestException('Invalid end_time value');
        }
        updateData.end_time = endTime;
      }

      if (updateShiftDto.facility_name !== undefined) {
        updateData.facility_name = updateShiftDto.facility_name;
      }

      if (updateShiftDto.full_address !== undefined) {
        updateData.full_address = updateShiftDto.full_address;

        if (updateShiftDto.full_address) {
          try {
            const geocodeResult = await GoogleMapsService.geocodeAddress(
              updateShiftDto.full_address,
            );

            updateData.latitude = geocodeResult?.latitude ?? null;
            updateData.longitude = geocodeResult?.longitude ?? null;
          } catch (error) {
            const geocodeErrorMessage =
              error instanceof Error ? error.message : 'Unknown geocode error';
            console.error(
              'Failed to geocode address for shift update:',
              geocodeErrorMessage,
            );
          }
        } else {
          updateData.latitude = null;
          updateData.longitude = null;
        }
      }

      if (updateShiftDto.signing_bonus !== undefined) {
        updateData.signing_bonus = updateShiftDto.signing_bonus;
      }

      if (updateShiftDto.internal_po_number !== undefined) {
        updateData.internal_po_number = updateShiftDto.internal_po_number;
      }

      if (updateShiftDto.emergency_bonus !== undefined) {
        updateData.emergency_bonus = updateShiftDto.emergency_bonus;
      }

      if (updateShiftDto.notes !== undefined) {
        updateData.notes = updateShiftDto.notes;
      }

      if (updateShiftDto.status !== undefined) {
        updateData.status = updateShiftDto.status;
      }

      const updatedShift = await this.prisma.shift.update({
        where: { id },
        data: updateData,
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
          signing_bonus: true,
          internal_po_number: true,
          emergency_bonus: true,
          notes: true,
          status: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Shift updated successfully',
        data: updatedShift,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update shift');
    }
  }

  async remove(id: string) {
    try {
      const shift = await this.prisma.shift.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
        },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      if (shift.status !== ShiftStatus.published) {
        throw new BadRequestException('Only published shifts can be deleted');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.shiftApplication.deleteMany({
          where: { shift_id: id },
        });

        await tx.shift.delete({
          where: { id },
        });
      });

      return {
        success: true,
        message: 'Shift deleted successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete shift');
    }
  }

  async getPayRatesByRole(requestingUserId: string, role?: string) {
    try {
      const { serviceProviderId } =
        await this.providerContextHelper.resolveFromUser(requestingUserId);

      const where: Prisma.ProviderPayRateByRoleWhereInput = {
        service_provider_id: serviceProviderId,
      };

      if (role) {
        const normalizedRole = role.trim().toLowerCase();
        const validRoles = Object.values(ProfessionRole);

        if (!validRoles.includes(normalizedRole as ProfessionRole)) {
          throw new BadRequestException('Invalid role filter');
        }

        where.profession_role = normalizedRole as ProfessionRole;
      }

      const payRates = await this.prisma.providerPayRateByRole.findMany({
        where,
        select: {
          id: true,
          profession_role: true,
          pay_rate_hourly: true,
          updated_at: true,
        },
        orderBy: { profession_role: 'asc' },
      });

      return {
        success: true,
        message: 'Pay rates fetched successfully',
        data: payRates,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch pay rates by role',
      );
    }
  }

  async getEmergencyBonusOptions(requestingUserId: string) {
    try {
      const { serviceProviderId } =
        await this.providerContextHelper.resolveFromUser(requestingUserId);

      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id: serviceProviderId },
        select: { emergency_bonus_increments: true },
      });

      if (!provider) {
        throw new NotFoundException('Service provider not found');
      }

      const increments = this.normalizeBonusOptions(
        provider.emergency_bonus_increments,
      );

      return {
        success: true,
        message: 'Emergency bonus options fetched successfully',
        data: increments,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch emergency bonus options',
      );
    }
  }

  private getShiftDates(startDateValue: string, endDateValue?: string) {
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

  private normalizeBonusOptions(
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
}
