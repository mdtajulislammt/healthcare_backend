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

@Injectable()
export class ApplyShiftService {
  constructor(private readonly prisma: PrismaService) { }

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
        select: { id: true, user_id: true },
      });

      if (!staffProfile) {
        throw new BadRequestException('Staff profile not found. Please complete your profile first.');
      }

      const staff_id = staffProfile.id;

      // Check if shift exists and is in a valid status for application
      const shift = await this.prisma.shift.findUnique({
        where: { id: shift_id },
        select: {
          id: true,
          status: true,
          assigned_staff_id: true,
        },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      // Validate shift status - only published shifts can be applied to
      if (shift.status !== 'published') {
        throw new BadRequestException(
          `Cannot apply to shift with status: ${shift.status}. Only published shifts can be applied to.`,
        );
      }

      // Check if shift is already assigned
      if (shift.assigned_staff_id) {
        throw new BadRequestException('This shift has already been assigned to another staff member.');
      }

      // Check if staff has already applied to this shift
      const existingApplication = await this.prisma.shiftApplication.findUnique({
        where: {
          shift_id_staff_id: {
            shift_id,
            staff_id,
          },
        },
      });

      let application;

      if (existingApplication) {
        // Check application status
        if (existingApplication.status === 'pending') {
          throw new BadRequestException('You have already applied to this shift. Your application is pending review.');
        } else if (existingApplication.status === 'accepted') {
          throw new BadRequestException('You have already been accepted for this shift.');
        } else if (existingApplication.status === 'rejected') {
          throw new BadRequestException('Your application for this shift was rejected. You cannot re-apply to a rejected shift.');
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
    page = 1,
    limit = 10,
    search = '',
    staff_id,
    staff_latitude,
    staff_longitude,
    status,
    max_distance_miles,
    max_distance_km,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    staff_id?: string;
    staff_latitude?: number;
    staff_longitude?: number;
    status?: string;
    max_distance_miles?: number;
    max_distance_km?: number;
  } = {}) {
    try {
      const currentPage = Math.max(Number(page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
      if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
        throw new BadRequestException('Invalid pagination parameters');
      }
      const skip = (currentPage - 1) * pageSize;

      // Build filter: Show published shifts OR shifts assigned to this staff member
      const shiftFilterConditions: Prisma.ShiftWhereInput[] = [
        { status: 'published' }, // All published shifts
      ];

      // Add condition for shifts assigned to this staff member
      if (staff_id) {
        shiftFilterConditions.push({
          assigned_staff_id: staff_id, // Shifts assigned to this user
        });
      }

      // Build AND conditions array
      const andConditions: Prisma.ShiftWhereInput[] = [
        {
          OR: shiftFilterConditions, // Main filter: published OR assigned to this user
        },
      ];

      // Add search filter if provided
      if (search) {
        andConditions.push({
          OR: [
            { posting_title: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
            { facility_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
            { full_address: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          ],
        });
      }

      // Add status filter if provided (further filter the results)
      if (status) {
        const validStatuses: ShiftStatus[] = ['draft', 'published', 'assigned', 'completed', 'cancelled'];
        if (validStatuses.includes(status as ShiftStatus)) {
          andConditions.push({
            status: status as ShiftStatus,
          });
        }
      }

      // Combine all filters with AND
      const where: Prisma.ShiftWhereInput =
        andConditions.length === 1
          ? andConditions[0] // If only one condition, no need for AND wrapper
          : {
            AND: andConditions,
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
            latitude: true,
            longitude: true,
            pay_rate_hourly: true,
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
            applications: staff_id
              ? {
                where: { staff_id },
                select: {
                  id: true,
                  status: true,
                  applied_at: true,
                },
                take: 1,
              }
              : false,
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      // Calculate distances if staff coordinates provided
      let itemsWithDistance = await Promise.all(
        itemsRaw.map(async (shift) => {
          const { applications, ...rest } = shift as any;

          // Calculate distance using helper
          const distanceData = await DistanceHelper.calculateDistance({
            staff_latitude,
            staff_longitude,
            shift_latitude: rest.latitude,
            shift_longitude: rest.longitude,
          });

          // Calculate time ago
          const publishedAgo = rest.created_at ? DateHelper.getTimeAgo(new Date(rest.created_at)) : null;

          return {
            ...rest,
            has_applied: staff_id ? (applications && applications.length > 0) : false,
            application: staff_id && applications && applications.length > 0 ? applications[0] : null,
            published_ago: publishedAgo,
            ...distanceData,
          };
        }),
      );

      // Apply distance filter if provided
      let items = itemsWithDistance;
      if (max_distance_miles !== undefined || max_distance_km !== undefined) {
        items = itemsWithDistance.filter((item) => {
          if (max_distance_miles !== undefined && item.distance_miles !== undefined) {
            return item.distance_miles <= max_distance_miles;
          }
          if (max_distance_km !== undefined && item.distance_km !== undefined) {
            return item.distance_km <= max_distance_km;
          }
          // If distance not calculated, exclude from results when distance filter is applied
          return false;
        });
      }

      // Recalculate total after distance filtering
      const filteredTotal = items.length;

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
    staff_id?: string,
    staff_latitude?: number,
    staff_longitude?: number,
  ) {
    try {
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
        staff_latitude,
        staff_longitude,
        shift_latitude: shift.latitude,
        shift_longitude: shift.longitude,
      });

      // Calculate published ago
      const publishedAgo = shift.created_at ? DateHelper.getTimeAgo(new Date(shift.created_at)) : null;

      // Format applications
      let has_applied = false;
      let application = null;
      const applications_list = Array.isArray(shift.applications) ? shift.applications : [];

      if (staff_id) {
        has_applied = applications_list.length > 0;
        application = applications_list.length > 0 ? applications_list[0] : null;
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

  update(id: string, updateApplyShiftDto: UpdateApplyShiftDto) {
    return `This action updates a #${id} applyShift`;
  }

  remove(id: string) {
    return `This action removes a #${id} applyShift`;
  }
}
