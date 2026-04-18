import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, ProfessionRole } from '@prisma/client';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { UpdateEmergencyBonusDto } from './dto/update-emergency-bonus.dto';
import { UpdatePayRateByRoleDto } from 'src/modules/admin/service-provider/dto/update-pay-rate-by-role.dto';

@Injectable()
export class ServiceProviderService {
  constructor(private readonly prisma: PrismaService) {}

  create(createServiceProviderDto: CreateServiceProviderDto) {
    return 'This action adds a new serviceProvider';
  }

  async findAll({
    page = 1,
    limit = 10,
    search = '',
    status,
    main_service_type,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    main_service_type?: string;
  } = {}) {
    try {
      const currentPage = Math.max(Number(page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
      if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
        throw new BadRequestException('Invalid pagination parameters');
      }
      const skip = (currentPage - 1) * pageSize;

      // Build where clause
      const andConditions: any[] = [];

      // Search filter
      if (search) {
        andConditions.push({
          OR: [
            {
              organization_name: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
            {
              first_name: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
            {
              last_name: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
            {
              user: {
                email: {
                  contains: search,
                  mode: 'insensitive' as Prisma.QueryMode,
                },
              },
            },
          ],
        });
      }

      // Status filter (0=pending, 1=active, 2=suspended)
      if (status) {
        const statusValue = status.toLowerCase().trim();
        let userStatus: number | undefined;

        if (statusValue === 'pending' || statusValue === '0') {
          userStatus = 0;
        } else if (statusValue === 'active' || statusValue === '1') {
          userStatus = 1;
        } else if (statusValue === 'suspended' || statusValue === '2') {
          userStatus = 2;
        }

        if (userStatus !== undefined) {
          andConditions.push({ user: { status: userStatus } });
        }
      }

      // Main service type filter (enum field - use exact match)
      if (main_service_type) {
        const serviceTypeValue = main_service_type.trim();
        andConditions.push({
          main_service_type: serviceTypeValue,
        });
      }

      const where =
        andConditions.length > 0 ? { AND: andConditions } : undefined;

      const [total, providers] = await this.prisma.$transaction([
        this.prisma.serviceProviderInfo.count({ where }),
        this.prisma.serviceProviderInfo.findMany({
          where,
          select: {
            id: true,
            user_id: true,
            first_name: true,
            last_name: true,
            organization_name: true,
            main_service_type: true,
            brand_logo_url: true,
            mobile_code: true,
            mobile_number: true,
            cqc_provider_number: true,
            vat_tax_id: true,
            website: true,
            primary_address: true,
            max_client_capacity: true,
            support_documents_url: true,
            emergency_bonus_increments: true,
            pay_rates_by_role: {
              select: {
                profession_role: true,
                pay_rate_hourly: true,
              },
              orderBy: { profession_role: 'asc' },
            },
            created_at: true,
            updated_at: true,
            user: {
              select: { id: true, email: true, status: true },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      for (const p of providers) {
        if (p.brand_logo_url) {
          p.brand_logo_url = SojebStorage.url(
            appConfig().storageUrl.brand + p.brand_logo_url,
          );
        }
      }

      return {
        success: true,
        message: 'Service providers fetched successfully',
        data: providers,
        meta: {
          total,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch service providers',
      );
    }
  }

  async findOne(id: string) {
    try {
      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              status: true,
              approved_at: true,
              email_verified_at: true,
            },
          },
          employees: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              mobile_code: true,
              mobile_number: true,
              employee_role: true,
              is_active: true,
              created_at: true,
            },
          },
          pay_rates_by_role: {
            select: {
              profession_role: true,
              pay_rate_hourly: true,
              updated_at: true,
            },
            orderBy: { profession_role: 'asc' },
          },
          shifts: { select: { id: true }, take: 0 },
        },
      });
      if (!provider) throw new NotFoundException('Service provider not found');

      if (provider.brand_logo_url) {
        provider.brand_logo_url = SojebStorage.url(
          appConfig().storageUrl.brand + provider.brand_logo_url,
        );
      }

      return {
        success: true,
        message: 'Service provider fetched successfully',
        data: provider,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch service provider',
      );
    }
  }

  update(id: string, updateServiceProviderDto: UpdateServiceProviderDto) {
    return `This action updates a #${id} serviceProvider`;
  }

  remove(id: string) {
    return `This action removes a #${id} serviceProvider`;
  }

  async updateStatus(id: string, status: number) {
    try {
      const allowed = new Set([0, 1, 2]);
      if (!allowed.has(Number(status))) {
        throw new BadRequestException(
          'Invalid status. Allowed: 0=pending, 1=active, 2=suspended',
        );
      }

      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id },
        select: { id: true, user_id: true },
      });
      if (!provider) throw new NotFoundException('Service provider not found');

      const updateData: any = { status: Number(status) };
      if (Number(status) === 1) {
        updateData.approved_at = new Date();
      } else {
        updateData.approved_at = null;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: provider.user_id },
        data: updateData,
        select: {
          id: true,
          email: true,
          status: true,
          approved_at: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Service provider status updated successfully',
        data: updatedUser,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed to update service provider status',
      );
    }
  }

  async updatePayRateByRole(id: string, dto: UpdatePayRateByRoleDto) {
    try {
      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!provider) throw new NotFoundException('Service provider not found');

      const payRate = Number(dto.pay_rate_hourly);
      if (Number.isNaN(payRate) || payRate <= 0) {
        throw new BadRequestException('Pay rate hourly must be greater than 0');
      }

      const updated = await (this.prisma as any).providerPayRateByRole.upsert({
        where: {
          service_provider_id_profession_role: {
            service_provider_id: id,
            profession_role: dto.profession_role,
          },
        },
        update: {
          pay_rate_hourly: payRate,
        },
        create: {
          service_provider_id: id,
          profession_role: dto.profession_role,
          pay_rate_hourly: payRate,
        },
        select: {
          id: true,
          profession_role: true,
          pay_rate_hourly: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Pay rate for role updated successfully',
        data: updated,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed to update pay rate for role',
      );
    }
  }

  async getPayRatesByRole(id: string, role?: string) {
    try {
      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id },
        select: { id: true, organization_name: true },
      });

      if (!provider) {
        throw new NotFoundException('Service provider not found');
      }

      const where: any = {
        service_provider_id: id,
      };

      if (role) {
        const normalizedRole = role.trim().toLowerCase();
        const validRoles = Object.values(ProfessionRole);

        if (!validRoles.includes(normalizedRole as ProfessionRole)) {
          throw new BadRequestException('Invalid role filter');
        }

        where.profession_role = normalizedRole as ProfessionRole;
      }

      const payRates = await (
        this.prisma as any
      ).providerPayRateByRole.findMany({
        where,
        select: {
          id: true,
          profession_role: true,
          pay_rate_hourly: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: { profession_role: 'asc' },
      });

      return {
        success: true,
        message: 'Pay rates fetched successfully',
        data: {
          service_provider_id: provider.id,
          organization_name: provider.organization_name,
          pay_rates: payRates,
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException('Failed to fetch pay rates');
    }
  }

  async updateEmergencyBonus(id: string, dto: UpdateEmergencyBonusDto) {
    try {
      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!provider) throw new NotFoundException('Service provider not found');

      const uniqueIncrements = Array.from(
        new Set(
          dto.increments.map((value) => {
            if (typeof value !== 'number' || Number.isNaN(value)) {
              throw new BadRequestException(
                'All increments must be valid numbers',
              );
            }
            return Number(value);
          }),
        ),
      ).filter((value) => value >= 0);

      if (!uniqueIncrements.length) {
        throw new BadRequestException(
          'Provide at least one non-negative increment value',
        );
      }

      uniqueIncrements.sort((a, b) => a - b);

      const updated = await this.prisma.serviceProviderInfo.update({
        where: { id },
        data: {
          emergency_bonus_increments: uniqueIncrements,
        },
        select: {
          id: true,
          organization_name: true,
          emergency_bonus_increments: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Emergency bonus increments updated successfully',
        data: updated,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed to update emergency bonus increments',
      );
    }
  }

  async getStats() {
    try {
      const [total, pending, active, suspended] =
        await this.prisma.$transaction([
          this.prisma.serviceProviderInfo.count(),
          this.prisma.serviceProviderInfo.count({
            where: { user: { status: 0 } },
          }),
          this.prisma.serviceProviderInfo.count({
            where: { user: { status: 1 } },
          }),
          this.prisma.serviceProviderInfo.count({
            where: { user: { status: 2 } },
          }),
        ]);

      return {
        success: true,
        message: 'Service provider statistics fetched successfully',
        data: { total, pending, active, suspended },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch service provider statistics',
      );
    }
  }
}
