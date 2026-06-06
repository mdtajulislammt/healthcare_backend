import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateShiftApplicationDto } from './dto/create-shift-application.dto';
import { UpdateShiftApplicationDto } from './dto/update-shift-application.dto';
import { AcceptApplicationDto } from './dto/accept-application.dto';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Prisma, ShiftApplicationStatus, ShiftStatus } from '@prisma/client';
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { PushNotificationService } from 'src/common/service/push-notification.service';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';
import { NotificationGateway } from 'src/modules/application/notification/notification.gateway';

@Injectable()
export class ShiftApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  create(createShiftApplicationDto: CreateShiftApplicationDto) {
    return 'This action adds a new shiftApplication';
  }

  async findAll(
    user_id: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      dateOrder?: 'asc' | 'desc';
      shiftId?: string;
    } = {},
  ) {
    try {
      const serviceProvider = await this.prisma.serviceProviderInfo.findFirst({
        where: { user_id },
        select: { id: true },
      });

      if (!serviceProvider) {
        throw new ForbiddenException(
          'Service provider profile not found. Only service providers can view applications.',
        );
      }

      const currentPage = Math.max(Number(params.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
      if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
        throw new BadRequestException('Invalid pagination parameters');
      }
      const skip = (currentPage - 1) * pageSize;

      let statusFilter: ShiftApplicationStatus | undefined;
      if (params.status) {
        const statusKey = params.status.toLowerCase();
        if (statusKey !== 'all') {
          const statusMap: Record<string, ShiftApplicationStatus> = {
            new: ShiftApplicationStatus.pending,
            pending: ShiftApplicationStatus.pending,
            accepted: ShiftApplicationStatus.accepted,
            rejected: ShiftApplicationStatus.rejected,
            cancelled: ShiftApplicationStatus.cancelled,
          };
          statusFilter = statusMap[statusKey];
          if (!statusFilter) {
            throw new BadRequestException('Invalid application status filter');
          }
        }
      }

      const filters: Prisma.ShiftApplicationWhereInput[] = [
        { shift: { service_provider_id: serviceProvider.id } },
      ];

      if (statusFilter) {
        filters.push({ status: statusFilter });
      }

      if (params.shiftId) {
        filters.push({ shift_id: params.shiftId });
      }

      const searchTerm = params.search?.trim();
      if (searchTerm) {
        filters.push({
          OR: [
            {
              shift: {
                posting_title: {
                  contains: searchTerm,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
            {
              shift: {
                facility_name: {
                  contains: searchTerm,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
            {
              staff: {
                first_name: {
                  contains: searchTerm,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
            {
              staff: {
                last_name: {
                  contains: searchTerm,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          ],
        });
      }

      const where: Prisma.ShiftApplicationWhereInput =
        filters.length > 1 ? { AND: filters } : filters[0];

      const requestedOrder = params.dateOrder?.toLowerCase();
      const orderBy: Prisma.ShiftApplicationOrderByWithRelationInput = {
        applied_at: requestedOrder === 'asc' ? 'asc' : 'desc',
      };

      const [total, applications] = await this.prisma.$transaction([
        this.prisma.shiftApplication.count({ where }),
        this.prisma.shiftApplication.findMany({
          where,
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
                photo_url: true,
                roles: true,
                mobile_code: true,
                mobile_number: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
                reviews: {
                  where: { status: 'approved' },
                  select: {
                    rating: true,
                  },
                },
              },
            },
          },
          orderBy,
          skip,
          take: pageSize,
        }),
      ]);

      const storage = appConfig().storageUrl.staff;
      const formatted = applications.map((application) => {
        const staffReviews = application.staff?.reviews ?? [];
        const reviewCount = staffReviews.length;
        const avgRating = reviewCount
          ? staffReviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviewCount
          : null;

        const staff = application.staff
          ? {
              id: application.staff.id,
              first_name: application.staff.first_name,
              last_name: application.staff.last_name,
              roles: application.staff.roles,
              mobile_code: application.staff.mobile_code,
              mobile_number: application.staff.mobile_number,
              user: application.staff.user,
              photo_url: application.staff.photo_url
                ? SojebStorage.url(storage + application.staff.photo_url)
                : null,
              avg_rating:
                avgRating !== null ? Number(avgRating.toFixed(1)) : null,
              review_count: reviewCount,
            }
          : null;

        return {
          ...application,
          staff,
        };
      });

      return {
        success: true,
        message: 'Shift applications fetched successfully',
        data: formatted,
        meta: {
          total,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch applications');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} shiftApplication`;
  }

  update(id: number, updateShiftApplicationDto: UpdateShiftApplicationDto) {
    return `This action updates a #${id} shiftApplication`;
  }

  remove(id: number) {
    return `This action removes a #${id} shiftApplication`;
  }

  /**
   * Accept or reject a shift application
   * @param applicationId - The ID of the application to accept/reject
   * @param user_id - The user ID from JWT token
   * @param acceptApplicationDto - DTO containing action (accepted/rejected) and optional notes
   */
  async acceptApplication(
    applicationId: string,
    user_id: string,
    acceptApplicationDto: AcceptApplicationDto,
  ) {
    try {
      const { action, notes } = acceptApplicationDto;

      // Get service provider from user_id
      const serviceProvider = await this.prisma.serviceProviderInfo.findFirst({
        where: { user_id },
        select: { id: true, user_id: true },
      });

      if (!serviceProvider) {
        throw new ForbiddenException(
          'Service provider profile not found. Only service providers can accept applications.',
        );
      }

      // Get the application with shift details
      const application = await this.prisma.shiftApplication.findUnique({
        where: { id: applicationId },
        include: {
          shift: {
            select: {
              id: true,
              service_provider_id: true,
              status: true,
              assigned_staff_id: true,
              posting_title: true,
            },
          },
          staff: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      // Verify that the shift belongs to the service provider
      if (application.shift.service_provider_id !== serviceProvider.id) {
        throw new ForbiddenException(
          'You do not have permission to accept/reject this application. This shift does not belong to your service provider.',
        );
      }

      // Validate application status
      if (application.status !== 'pending') {
        throw new BadRequestException(
          `Cannot ${action} an application with status: ${application.status}. Only pending applications can be ${action}.`,
        );
      }

      // If accepting, validate shift status
      if (action === 'accepted') {
        // Check if shift is still published (not already assigned, completed, or cancelled)
        if (application.shift.status !== 'published') {
          throw new BadRequestException(
            `Cannot accept application. Shift status is: ${application.shift.status}. Only published shifts can accept applications.`,
          );
        }

        // Check if shift is already assigned to someone else
        if (
          application.shift.assigned_staff_id &&
          application.shift.assigned_staff_id !== application.staff_id
        ) {
          throw new BadRequestException(
            'This shift has already been assigned to another staff member.',
          );
        }

        // Use transaction to ensure atomicity
        const result = await this.prisma.$transaction(async (tx) => {
          // Update the application status to accepted
          const updatedApplication = await tx.shiftApplication.update({
            where: { id: applicationId },
            data: {
              status: 'accepted' as ShiftApplicationStatus,
              reviewed_at: new Date(),
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
                  user: {
                    select: {
                      id: true,
                      email: true,
                    },
                  },
                },
              },
            },
          });

          // Assign staff to the shift
          await tx.shift.update({
            where: { id: application.shift.id },
            data: {
              assigned_staff_id: application.staff_id,
              status: 'assigned' as ShiftStatus,
            },
          });

          // Reject all other pending applications for this shift
          await tx.shiftApplication.updateMany({
            where: {
              shift_id: application.shift.id,
              staff_id: { not: application.staff_id },
              status: 'pending',
            },
            data: {
              status: 'rejected' as ShiftApplicationStatus,
              reviewed_at: new Date(),
              notes:
                'Application rejected. Shift has been assigned to another applicant.',
            },
          });

          return updatedApplication;
        });

        // Notify and push to staff user if user id is available
        const staffUserId = application.staff.user?.id;
        if (staffUserId) {
          await NotificationRepository.createNotification({
            receiver_id: staffUserId,
            text: `You have been assigned to shift: ${application.shift.posting_title}`,
            type: 'shift_assigned',
            entity_id: application.shift.id,
          });

          await this.pushNotificationService.sendToUser(staffUserId, {
            title: 'Shift Assigned',
            body: `You have been assigned to shift: ${application.shift.posting_title}`,
            data: {
              type: 'shift_assigned',
              shiftId: application.shift.id,
            },
          });
        }

        // Notify all admins (websocket + DB)
        const adminUsers = await this.prisma.user.findMany({
          where: { type: 'admin' },
          select: { id: true },
        });

        const adminTitle = 'Shift Assigned';
        const adminBody = `Staff ${application.staff.first_name} ${application.staff.last_name} assigned to shift: ${application.shift.posting_title}`;

        for (const admin of adminUsers) {
          const notification = await NotificationRepository.createNotification({
            receiver_id: admin.id,
            text: adminBody,
            type: 'shift_assigned',
            entity_id: application.shift.id,
          });

          await this.notificationGateway.sendNotificationToUser({
            userId: admin.id,
            title: adminTitle,
            body: adminBody,
            notificationId: notification.id,
            data: {
              type: 'shift_assigned',
              shiftId: application.shift.id,
              staffId: application.staff.id,
              staffName: `${application.staff.first_name} ${application.staff.last_name}`,
            },
          });
        }

        return {
          success: true,
          message:
            'Application accepted successfully. Staff has been assigned to the shift.',
          data: result,
        };
      } else {
        // Reject the application
        const updatedApplication = await this.prisma.shiftApplication.update({
          where: { id: applicationId },
          data: {
            status: 'rejected' as ShiftApplicationStatus,
            reviewed_at: new Date(),
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
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
          },
        });

        // Notify and push to staff user if user id is available
        const staffUserId = application.staff.user?.id;
        if (staffUserId) {
          await NotificationRepository.createNotification({
            receiver_id: staffUserId,
            text: `Your application for shift: ${application.shift.posting_title} has been rejected`,
            type: 'shift_rejected',
            entity_id: application.shift.id,
          });

          await this.pushNotificationService.sendToUser(staffUserId, {
            title: 'Application Rejected',
            body: `Your application for shift: ${application.shift.posting_title} has been rejected`,
            data: {
              type: 'shift_rejected',
              shiftId: application.shift.id,
            },
          });
        }

        // Notify all admins (websocket + DB)
        const adminUsers = await this.prisma.user.findMany({
          where: { type: 'admin' },
          select: { id: true },
        });

        const adminTitle = 'Shift Application Rejected';
        const adminBody = `Service provider rejected application for ${application.staff.first_name} ${application.staff.last_name} - shift: ${application.shift.posting_title}`;

        for (const admin of adminUsers) {
          const notification = await NotificationRepository.createNotification({
            receiver_id: admin.id,
            text: adminBody,
            type: 'shift_rejected',
            entity_id: application.shift.id,
          });

          await this.notificationGateway.sendNotificationToUser({
            userId: admin.id,
            title: adminTitle,
            body: adminBody,
            notificationId: notification.id,
            data: {
              type: 'shift_rejected',
              shiftId: application.shift.id,
              staffId: application.staff.id,
              staffName: `${application.staff.first_name} ${application.staff.last_name}`,
            },
          });
        }

        return {
          success: true,
          message: 'Application rejected successfully',
          data: updatedApplication,
        };
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process application');
    }
  }

  async viewApplicantProfile(applicationId: string, user_id: string) {
    try {
      // ─── Resolve Service Provider ─────────────────────────────────────────────
      const serviceProvider = await this.prisma.serviceProviderInfo.findFirst({
        where: { user_id },
        select: { id: true },
      });

      if (!serviceProvider) {
        throw new ForbiddenException(
          'Service provider profile not found. Only service providers can view applicant profiles.',
        );
      }

      // ─── Date Range ───────────────────────────────────────────────────────────
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

      // ─── Fetch Application ────────────────────────────────────────────────────
      const application = await this.prisma.shiftApplication.findUnique({
        where: { id: applicationId },
        include: {
          shift: {
            select: {
              id: true,
              service_provider_id: true,
              posting_title: true,
              facility_name: true,
              start_date: true,
              end_date: true,
              start_time: true,
              end_time: true,
              status: true,
              profession_role: true,
              shift_type: true,
            },
          },
          staff: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              bio: true,
              mobile_code: true,
              mobile_number: true,
              date_of_birth: true,
              photo_url: true,
              cv_url: true,
              roles: true,
              right_to_work_status: true,
              nmc_pin: true,
              experience: true,
              created_at: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  activity_logs: {
                    where: { created_at: { gte: twelveMonthsAgo } },
                    select: {
                      id: true,
                      action_type: true,
                      entity_type: true,
                      entity_id: true,
                      description: true,
                      metadata: true,
                      created_at: true,
                    },
                    orderBy: { created_at: 'desc' },
                    take: 50,
                  },
                },
              },
              certificates: {
                select: {
                  id: true,
                  certificate_type: true,
                  file_url: true,
                  verified_status: true,
                },
              },
              educations: {
                select: {
                  id: true,
                  institution_name: true,
                  degree: true,
                  field_of_study: true,
                  start_date: true,
                  end_date: true,
                },
              },
              dbs_info: true,
              reviews: {
                where: { status: 'approved' },
                select: {
                  id: true,
                  rating: true,
                  feedback: true,
                  created_at: true,
                },
              },
              timesheets: {
                where: {
                  status: {
                    in: [
                      'approved',
                      'invoiced',
                      'paid',
                      'submitted',
                      'under_review',
                    ],
                  },
                  created_at: { gte: twelveMonthsAgo },
                },
                select: {
                  total_hours: true,
                  shift: {
                    select: {
                      id: true,
                      start_time: true,
                    },
                  },
                },
              },
              applications: {
                where: { applied_at: { gte: twelveMonthsAgo } },
                select: { status: true },
              },
              shifts_assigned: {
                where: {
                  start_date: { gte: twelveMonthsAgo },
                  status: { in: ['completed', 'assigned'] },
                },
                select: {
                  id: true,
                  posting_title: true,
                  status: true,
                  facility_name: true,
                  start_date: true,
                  start_time: true,
                  end_time: true,
                  profession_role: true,
                  is_urgent: true,
                  timesheet: {
                    select: {
                      total_hours: true,
                      total_pay: true,
                    },
                  },
                },
                orderBy: { start_date: 'desc' },
                take: 5,
              },
            },
          },
        },
      });

      // ─── Guards ───────────────────────────────────────────────────────────────
      if (!application) {
        throw new NotFoundException('Application not found.');
      }

      if (application.shift.service_provider_id !== serviceProvider.id) {
        throw new ForbiddenException(
          'You do not have permission to view this applicant. This shift does not belong to your service provider.',
        );
      }

      const staffProfile = application.staff;

      if (!staffProfile) {
        throw new NotFoundException(
          'Staff profile not found for this application.',
        );
      }

      // ─── Parallel Queries: Preference + Attendance ────────────────────────────
      const timesheetShiftIds = (staffProfile.timesheets ?? [])
        .map((t) => t.shift?.id)
        .filter(Boolean) as string[];

      const [preferences, attendances] = await Promise.all([
        this.prisma.providerStaffPreference.findMany({
          where: {
            provider_id: serviceProvider.id,
            staff_id: staffProfile.id,
          },
          select: { preference_type: true },
        }),
        timesheetShiftIds.length
          ? this.prisma.shiftAttendance.findMany({
              where: { shift_id: { in: timesheetShiftIds } },
              select: {
                shift_id: true,
                check_in_time: true,
                shift: {
                  select: { start_time: true },
                },
              },
            })
          : Promise.resolve([]),
      ]);

      // ─── Preference Flags ─────────────────────────────────────────────────────
      const is_favorite = preferences.some(
        (p) => p.preference_type === 'favorite',
      );
      const is_blocked = preferences.some(
        (p) => p.preference_type === 'blocked',
      );

      // ─── Ratings ──────────────────────────────────────────────────────────────
      const reviews = staffProfile.reviews ?? [];
      const reviewCount = reviews.length;
      const avgRatingRaw = reviewCount
        ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviewCount
        : null;
      const avg_rating =
        avgRatingRaw !== null ? Number(avgRatingRaw.toFixed(1)) : null;

      // ─── Performance Stats ────────────────────────────────────────────────────
      const timesheets = staffProfile.timesheets ?? [];
      const applications = staffProfile.applications ?? [];

      const total_shifts = timesheets.length;
      const total_hours = Number(
        timesheets.reduce((sum, t) => sum + (t.total_hours ?? 0), 0).toFixed(1),
      );

      const attendedShifts = attendances.filter((a) => a.check_in_time);

      const onTimeCount = attendedShifts.filter((a) => {
        const checkIn = new Date(a.check_in_time!).getTime();
        const shiftStart = new Date(a.shift.start_time).getTime();
        return checkIn <= shiftStart + 15 * 60 * 1000; // within 5 min
      }).length;

      const on_time_rate =
        attendedShifts.length > 0
          ? `${Math.round((onTimeCount / attendedShifts.length) * 100)}%`
          : null;

      const cancelledCount = applications.filter(
        (a) => a.status === 'cancelled',
      ).length;
      const cancellation_rate =
        applications.length > 0
          ? `${Number(((cancelledCount / applications.length) * 100).toFixed(1))}%`
          : null;

      const performance = {
        period: 'last_12_months',
        total_shifts,
        total_hours,
        on_time_rate,
        cancellation_rate,
      };

      // ─── Shift History ────────────────────────────────────────────────────────
      const shift_history = (staffProfile.shifts_assigned ?? []).map(
        (shift) => ({
          id: shift.id,
          posting_title: shift.posting_title,
          profession_role: shift.profession_role,
          is_urgent: shift.is_urgent,
          status: shift.status,
          facility_name: shift.facility_name,
          start_date: shift.start_date,
          duration_hours:
            shift.timesheet?.total_hours != null
              ? Number(shift.timesheet.total_hours.toFixed(1))
              : null,
          total_pay:
            shift.timesheet?.total_pay != null
              ? Number(shift.timesheet.total_pay.toFixed(2))
              : null,
        }),
      );

      // ─── Activity Logs ────────────────────────────────────────────────────────
      const activity_logs = (staffProfile.user?.activity_logs ?? []).map(
        (log) => ({
          id: log.id,
          action_type: log.action_type,
          entity_type: log.entity_type ?? null,
          entity_id: log.entity_id ?? null,
          description: log.description,
          metadata: log.metadata ?? null,
          created_at: log.created_at,
        }),
      );

      // ─── Storage URLs ─────────────────────────────────────────────────────────
      const storageConfig = appConfig().storageUrl;

      const resolveUrl = (base: string, path: string | null) =>
        path ? SojebStorage.url(base + path) : null;

      // ─── Build Response ───────────────────────────────────────────────────────
      const staff = {
        ...staffProfile,
        photo_url: resolveUrl(storageConfig.staff, staffProfile.photo_url),
        cv_url: resolveUrl(storageConfig.cv, staffProfile.cv_url),
        avg_rating,
        review_count: reviewCount,
        is_favorite,
        is_blocked,
        performance,
        shift_history,
        activity_logs,
        certificates: (staffProfile.certificates ?? []).map((cert) => ({
          ...cert,
          file_url: resolveUrl(storageConfig.certificate, cert.file_url),
        })),
      };

      return {
        success: true,
        message: 'Applicant profile fetched successfully.',
        data: {
          application: {
            id: application.id,
            status: application.status,
            applied_at: application.applied_at,
            reviewed_at: application.reviewed_at,
            notes: application.notes,
            shift: application.shift,
          },
          staff,
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
        'Failed to fetch applicant profile',
      );
    }
  }
}
