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
import {
  calculateShiftHours,
  createAndLogShifts,
  formatDateKey,
  getShiftDates,
  normalizeBonusOptions,
} from './utils/shift.utils';
import { calculateRating } from 'src/common/helper/rating.helper';

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
        select: { pay_rate_hourly: true, platform_margin: true },
      });

      const providerPayRateHourly = rolePayRate
        ? Number(rolePayRate.pay_rate_hourly)
        : null;
      const providerPlatformMargin = rolePayRate
        ? rolePayRate.platform_margin
          ? Number(rolePayRate.platform_margin)
          : 0
        : 0;
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

      const bonusOptions = normalizeBonusOptions(
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

      const startTimeValue = new Date(start_time);
      const endTimeValue = new Date(end_time);
      if (
        Number.isNaN(startTimeValue.getTime()) ||
        Number.isNaN(endTimeValue.getTime())
      ) {
        throw new BadRequestException('Invalid start_time or end_time value');
      }

      const shiftDates = getShiftDates(start_date, end_date);

      const shifts = await createAndLogShifts({
        prisma: this.prisma,
        activityLogService: this.activityLogService,
        serviceProviderId,
        createdByEmployeeId: finalCreatorEmployeeId,
        assignedStaffId: assigned_staff_id,
        postingTitle: posting_title,
        shiftType: shift_type,
        professionRole: profession_role,
        isUrgent: is_urgent,
        shiftDates,
        startTimeValue: start_time,
        endTimeValue: end_time,
        facilityName: facility_name,
        fullAddress: full_address,
        latitude,
        longitude,
        payRateHourly: providerPayRateHourly,
        signingBonus: signing_bonus,
        internalPoNumber: internal_po_number,
        emergencyBonus: selectedEmergencyBonus,
        notes,
        status,
        requestingUserId,
        platformMargin: providerPlatformMargin,
      });

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
      filter,
      status,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      filter?: 'with_applicants' | 'without_applicants';
      status?: ShiftStatus;
    } = {},
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

      // ─── Validate status if provided ──────────────────────────────────────
      const validStatuses = Object.values(ShiftStatus);
      if (status && !validStatuses.includes(status)) {
        throw new BadRequestException(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        );
      }

      const searchCondition: Prisma.ShiftWhereInput = search
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
        : {};

      // ─── Applicant Filter ─────────────────────────────────────────────────
      const applicantFilterCondition: Prisma.ShiftWhereInput =
        filter === 'with_applicants'
          ? { applications: { some: {} } }
          : filter === 'without_applicants'
            ? { applications: { none: {} } }
            : {};

      // ─── Status Filter ────────────────────────────────────────────────────
      const statusCondition: Prisma.ShiftWhereInput = status ? { status } : {};

      const where: Prisma.ShiftWhereInput = {
        service_provider_id: serviceProviderId,
        ...statusCondition,
        ...applicantFilterCondition,
        ...searchCondition,
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
                  where: { status: 'approved' },
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
        const { avg_rating, review_count } = calculateRating(
          s.assigned_staff?.reviews ?? [],
        );

        const totalHours = calculateShiftHours(s.start_time, s.end_time);

        return {
          ...s,
          total_hours: totalHours,
          assigned_staff: s.assigned_staff
            ? {
                id: s.assigned_staff.id,
                first_name: s.assigned_staff.first_name,
                last_name: s.assigned_staff.last_name,
                avg_rating: avg_rating,
                review_count: review_count,
                photo_url: s.assigned_staff.photo_url
                  ? SojebStorage.url(
                      appConfig().storageUrl.staff + s.assigned_staff.photo_url,
                    )
                  : null,
              }
            : null,
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
          filter: filter ?? null,
          status: status ?? null,
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
              mobile_code: true,
              mobile_number: true,
              user: { select: { email: true } },
              reviews: {
                where: { status: 'approved' },
                select: { rating: true, feedback: true, created_at: true },
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
          timesheet: {
            select: {
              id: true,
              total_hours: true,
              total_pay: true,
              status: true,
              submitted_at: true,
              reviewed_at: true,
              approved_by: true,
              clock_in_verified: true,
              clock_out_verified: true,
              xero_status: true,
              paid_at: true,
              hourly_rate: true,
              xero_invoice_id: true,
              xero_invoice_number: true,
            },
          },
          reviews: {
            where: { status: 'approved' },
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

      // Fetch average rating and review counts for applicants
      const ratingMap = new Map<
        string,
        { avg: number | null; count: number }
      >();
      if (staffIds && staffIds.length) {
        const ratings = await this.prisma.staffPerformanceReview.groupBy({
          by: ['staff_id'],
          where: {
            staff_id: { in: staffIds },
            status: 'approved', // ← add this
          },
          _avg: { rating: true },
          _count: { id: true },
        });
        for (const r of ratings) {
          ratingMap.set(r.staff_id, {
            avg: r._avg?.rating ?? null,
            count: r._count?.id ?? 0,
          });
        }
      }

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
          // Attach avg rating and review count
          const ratingEntry = ratingMap.get(application.staff.id);
          (application.staff as any).avg_rating =
            ratingEntry && ratingEntry.avg !== null
              ? Number(ratingEntry.avg.toFixed(1))
              : null;
          (application.staff as any).review_count = ratingEntry
            ? ratingEntry.count
            : 0;
        }
      }

      // Format assigned staff photo URL if exists
      if (shift.assigned_staff?.photo_url) {
        shift.assigned_staff.photo_url = SojebStorage.url(
          appConfig().storageUrl.staff + shift.assigned_staff.photo_url,
        );
      }

      const totalHours = calculateShiftHours(shift.start_time, shift.end_time);

      // Calculate average rating for assigned staff
      let assignedStaffWithRating = null;
      if (shift.assigned_staff) {
        const { avg_rating, review_count } = calculateRating(
          shift.assigned_staff.reviews ?? [],
        );

        assignedStaffWithRating = {
          id: shift.assigned_staff.id,
          first_name: shift.assigned_staff.first_name,
          last_name: shift.assigned_staff.last_name,
          photo_url: shift.assigned_staff.photo_url,
          bio: shift.assigned_staff.bio,
          roles: shift.assigned_staff.roles,
          mobile_code: shift.assigned_staff.mobile_code,
          mobile_number: shift.assigned_staff.mobile_number,
          email: shift.assigned_staff.user?.email ?? null,
          avg_rating: avg_rating,
          review_count: review_count,
        };
      }

      const { _count, assigned_staff, reviews, ...rest } = shift as any;
      const formatted: any = {
        ...rest,
        assigned_staff: assignedStaffWithRating,
        total_hours: totalHours,
        applications_count: _count?.applications ?? 0,
        is_reviewed: reviews && reviews.length > 0,
      };

      // Resolve timesheet approver name (approved_by) when present
      if (shift.timesheet) {
        const ts: any = shift.timesheet;
        let approverName: string | null = null;
        if (ts.approved_by) {
          // Try service provider
          const sp = await this.prisma.serviceProviderInfo.findUnique({
            where: { id: ts.approved_by },
            select: { organization_name: true },
          });
          if (sp) {
            approverName = sp.organization_name;
          } else {
            // Try employee
            const emp = await this.prisma.employee.findUnique({
              where: { id: ts.approved_by },
              select: { first_name: true, last_name: true },
            });
            if (emp) approverName = `${emp.first_name} ${emp.last_name}`;
            else {
              // Try staff profile
              const staff = await this.prisma.staffProfile.findUnique({
                where: { id: ts.approved_by },
                select: { first_name: true, last_name: true },
              });
              if (staff)
                approverName = `${staff.first_name} ${staff.last_name}`;
              else {
                // Fallback to user email
                const user = await this.prisma.user.findUnique({
                  where: { id: ts.approved_by },
                  select: { email: true },
                });
                approverName = user ? (user.email ?? null) : null;
              }
            }
          }
        }

        formatted.timesheet = {
          ...ts,
          approved_by: approverName,
        };
      }

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

  async update(
    id: string,
    updateShiftDto: UpdateShiftDto,
    requestingUserId?: string,
  ) {
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

      // Load full shift data to use when creating multiple new shifts
      const existingShift = await this.prisma.shift.findUnique({
        where: { id },
        select: {
          start_date: true,
          posting_title: true,
          shift_type: true,
          profession_role: true,
          is_urgent: true,
          start_time: true,
          end_time: true,
          facility_name: true,
          full_address: true,
          signing_bonus: true,
          internal_po_number: true,
          emergency_bonus: true,
          notes: true,
          assigned_staff_id: true,
          created_by_employee_id: true,
          status: true,
        },
      });

      const isDateRangeUpdate =
        updateShiftDto.start_date !== undefined &&
        updateShiftDto.end_date !== undefined;

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

      if (updateShiftDto.start_date !== undefined && !isDateRangeUpdate) {
        const startDate = new Date(updateShiftDto.start_date);
        if (Number.isNaN(startDate.getTime())) {
          throw new BadRequestException('Invalid start_date value');
        }
        updateData.start_date = startDate;
      }

      if (updateShiftDto.end_date !== undefined && !isDateRangeUpdate) {
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
      // If a date range is supplied, create new shifts for dates that do not match the current shift date
      let createdShifts: any[] = [];
      if (isDateRangeUpdate) {
        const shiftDates = getShiftDates(
          updateShiftDto.start_date,
          updateShiftDto.end_date,
        );

        const currentDateKey = formatDateKey(existingShift?.start_date);
        const shiftDatesToCreate = shiftDates.filter(
          (shiftDate) => formatDateKey(shiftDate) !== currentDateKey,
        );

        if (shiftDatesToCreate.length) {
          const postingTitle =
            updateShiftDto.posting_title ?? existingShift?.posting_title;
          const shiftType =
            updateShiftDto.shift_type ?? existingShift?.shift_type;
          const professionRole =
            updateShiftDto.profession_role ?? existingShift?.profession_role;
          const isUrgent = updateShiftDto.is_urgent ?? existingShift?.is_urgent;
          const startTimeValue =
            updateShiftDto.start_time ?? existingShift?.start_time;
          const endTimeValue =
            updateShiftDto.end_time ?? existingShift?.end_time;
          const facilityName =
            updateShiftDto.facility_name ?? existingShift?.facility_name;
          const fullAddress =
            updateShiftDto.full_address !== undefined
              ? updateShiftDto.full_address
              : existingShift?.full_address;
          const signingBonus =
            updateShiftDto.signing_bonus ?? existingShift?.signing_bonus;
          const internalPoNumber =
            updateShiftDto.internal_po_number ??
            existingShift?.internal_po_number;
          const emergencyBonus =
            updateShiftDto.emergency_bonus ??
            existingShift?.emergency_bonus ??
            0;
          const notes = updateShiftDto.notes ?? existingShift?.notes;
          const assignedStaffId =
            updateShiftDto.assigned_staff_id ??
            existingShift?.assigned_staff_id ??
            null;

          if (assignedStaffId) {
            const staff = await this.prisma.staffProfile.findUnique({
              where: { id: assignedStaffId },
              select: { id: true },
            });
            if (!staff) {
              throw new BadRequestException('Assigned staff not found');
            }
          }

          const rolePayRate = await (
            this.prisma as any
          ).providerPayRateByRole.findUnique({
            where: {
              service_provider_id_profession_role: {
                service_provider_id: shift.service_provider_id,
                profession_role: professionRole,
              },
            },
            select: { pay_rate_hourly: true, platform_margin: true },
          });

          const providerPayRateHourly = rolePayRate
            ? Number(rolePayRate.pay_rate_hourly)
            : null;
          const providerPlatformMargin = rolePayRate
            ? rolePayRate.platform_margin
              ? Number(rolePayRate.platform_margin)
              : 0
            : 0;
          if (
            providerPayRateHourly === null ||
            providerPayRateHourly === undefined ||
            Number.isNaN(providerPayRateHourly) ||
            providerPayRateHourly <= 0
          ) {
            throw new BadRequestException(
              `Admin has not set pay rate for ${professionRole} role for this service provider`,
            );
          }

          let latitude: number | null = null;
          let longitude: number | null = null;
          if (fullAddress) {
            try {
              const geocodeResult =
                await GoogleMapsService.geocodeAddress(fullAddress);
              if (geocodeResult) {
                latitude = geocodeResult.latitude;
                longitude = geocodeResult.longitude;
              }
            } catch (error) {
              const geocodeErrorMessage =
                error instanceof Error
                  ? error.message
                  : 'Unknown geocode error';
              console.error(
                'Failed to geocode address for shift create (update):',
                geocodeErrorMessage,
              );
            }
          }

          createdShifts = await createAndLogShifts({
            prisma: this.prisma,
            activityLogService: this.activityLogService,
            serviceProviderId: shift.service_provider_id,
            createdByEmployeeId:
              updateShiftDto.created_by_employee_id ??
              existingShift?.created_by_employee_id ??
              null,
            assignedStaffId,
            postingTitle,
            shiftType,
            professionRole,
            isUrgent,
            shiftDates: shiftDatesToCreate,
            startTimeValue,
            endTimeValue,
            facilityName,
            fullAddress,
            latitude,
            longitude,
            payRateHourly: providerPayRateHourly,
            signingBonus,
            internalPoNumber,
            emergencyBonus,
            notes,
            status:
              updateShiftDto.status ??
              existingShift?.status ??
              ShiftStatus.published,
            requestingUserId,
            platformMargin: providerPlatformMargin,
          });
        }
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
        data: {
          updated: updatedShift,
          created_shifts: createdShifts,
        },
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
          platform_margin: true,
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

      const increments = normalizeBonusOptions(
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
}
