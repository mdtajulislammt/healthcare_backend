import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class ServiceProviderService {
  constructor(private readonly prisma: PrismaService) { }

  create(createServiceProviderDto: CreateServiceProviderDto) {
    return 'This action adds a new serviceProvider';
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
            { organization_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
            { first_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
            { last_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
            { user: { email: { contains: search, mode: 'insensitive' as Prisma.QueryMode } } },
          ],
        }
        : undefined;

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
            brand_logo_url: true,
            mobile_code: true,
            mobile_number: true,
            cqc_provider_number: true,
            website: true,
            max_client_capacity: true,
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
      throw new InternalServerErrorException('Failed to fetch service providers');
    }
  }

  async findOne(id: string) {
    try {
      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true, status: true, approved_at: true, email_verified_at: true } },
          employees: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
              employee_role: true,
              is_active: true,
              created_at: true,
            },
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

      return { success: true, message: 'Service provider fetched successfully', data: provider };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch service provider');
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
        throw new BadRequestException('Invalid status. Allowed: 0=pending, 1=active, 2=suspended');
      }

      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id },
        select: { id: true, user_id: true },
      });
      if (!provider) throw new NotFoundException('Service provider not found');

      const updatedUser = await this.prisma.user.update({
        where: { id: provider.user_id },
        data: { status: Number(status) },
        select: { id: true, email: true, status: true, updated_at: true },
      });

      return { success: true, message: 'Service provider status updated successfully', data: updatedUser };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update service provider status');
    }
  }

  async getStats() {
    try {
      const [total, pending, active, suspended] = await this.prisma.$transaction([
        this.prisma.serviceProviderInfo.count(),
        this.prisma.serviceProviderInfo.count({ where: { user: { status: 0 } } }),
        this.prisma.serviceProviderInfo.count({ where: { user: { status: 1 } } }),
        this.prisma.serviceProviderInfo.count({ where: { user: { status: 2 } } }),
      ]);

      return {
        success: true,
        message: 'Service provider statistics fetched successfully',
        data: { total, pending, active, suspended },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch service provider statistics');
    }
  }
}
