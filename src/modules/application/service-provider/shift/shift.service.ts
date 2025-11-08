import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateShiftDto } from './dto/create-shift.dto';
import { Prisma } from '@prisma/client';
import { UpdateShiftDto } from './dto/update-shift.dto';
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { PrismaService } from 'src/prisma/prisma.service';
import { GoogleMapsService } from 'src/common/lib/GoogleMaps/GoogleMapsService';

@Injectable()
export class ShiftService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createShiftDto: CreateShiftDto) {
    try {
      const {
        service_provider_id,
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
        pay_rate_hourly,
        signing_bonus,
        internal_po_number,
        emergency_bonus,
        notes,
        status,
      } = createShiftDto;

      const serviceProvider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id: service_provider_id },
        select: { id: true },
      });
      if (!serviceProvider) {
        throw new NotFoundException('Service provider not found');
      }

      if (created_by_employee_id) {
        const creator = await this.prisma.employee.findUnique({
          where: { id: created_by_employee_id },
          select: { id: true, service_provider_id: true },
        });
        if (!creator || creator.service_provider_id !== service_provider_id) {
          throw new BadRequestException('Creator employee is invalid for this service provider');
        }
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
          const geocodeResult = await GoogleMapsService.geocodeAddress(full_address);
          console.log('geocodeResult', geocodeResult);
          if (geocodeResult) {
            latitude = geocodeResult.latitude;
            longitude = geocodeResult.longitude;
          }
        } catch (error) {
          // Log error but continue without coordinates
          console.error('Failed to geocode address for shift:', error.message);
        }
      }

      console.log('latitude', latitude);
      console.log('longitude', longitude);

      const shift = await this.prisma.shift.create({
        data: {
          service_provider_id,
          created_by_employee_id,
          assigned_staff_id,
          posting_title,
          shift_type,
          profession_role,
          is_urgent,
          start_date: new Date(start_date),
          end_date: end_date ? new Date(end_date) : null,
          start_time: new Date(start_time),
          end_time: new Date(end_time),
          facility_name,
          full_address,
          latitude,
          longitude,
          pay_rate_hourly,
          signing_bonus,
          internal_po_number,
          emergency_bonus,
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
      });

      return {
        success: true,
        message: 'Shift created successfully',
        data: shift,
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

  async findAll({ page = 1, limit = 10, search = '' }: { page?: number; limit?: number; search?: string } = {}) {
    try {
      const currentPage = Math.max(Number(page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
      if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
        throw new BadRequestException('Invalid pagination parameters');
      }
      const skip = (currentPage - 1) * pageSize;

      const where = search
        ? {
          OR: [
            { posting_title: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
            { facility_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
            { full_address: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          ],
        }
        : undefined;

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
            created_at: true,
            _count: { select: { applications: true } },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      const items = itemsRaw.map((s) => ({
        ...s,
        applications_count: s._count?.applications ?? 0,
        _count: undefined,
      }));

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

  async findOne(id: string) {
    try {
      const shift = await this.prisma.shift.findUnique({
        where: { id },
        include: {
          service_provider_info: {
            select: { id: true, organization_name: true, user_id: true },
          },
          created_by_employee: {
            select: { id: true, first_name: true, last_name: true, email: true, employee_role: true },
          },
          assigned_staff: {
            select: { id: true, first_name: true, last_name: true, roles: true },
          },
          applications: {
            select: {
              id: true,
              status: true,
              applied_at: true,
              staff: {
                select: { id: true, first_name: true, last_name: true, photo_url: true },
              },
            },
            orderBy: { applied_at: 'desc' },
          },
          attendance: true,
          timesheet: true,
          reviews: {
            select: { id: true, rating: true, feedback: true, created_at: true },
            orderBy: { created_at: 'desc' },
          },
          _count: { select: { applications: true } },
        },
      });

      if (!shift) throw new NotFoundException('Shift not found');

      if (shift.applications && shift.applications.length) {
        for (const application of shift.applications) {
          if (application.staff.photo_url) {
            application.staff.photo_url = SojebStorage.url(
              appConfig().storageUrl.staff + application.staff.photo_url,
            );
          }
        }
      }
      const { _count, ...rest } = shift as any;
      const formatted = {
        ...rest,
        applications_count: _count?.applications ?? 0,
      };

      return { success: true, message: 'Shift fetched successfully', data: formatted };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch shift');
    }
  }

  update(id: string, updateShiftDto: UpdateShiftDto) {
    return `This action updates a #${id} shift`;
  }

  remove(id: string) {
    return `This action removes a #${id} shift`;
  }
}
