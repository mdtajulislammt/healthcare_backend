import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProfessionRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import appConfig from 'src/config/app.config';
import { UpdatePayRateByRoleDto } from 'src/modules/admin/service-provider/dto/update-pay-rate-by-role.dto';
import { UpdatePayRatesByRoleDto } from 'src/modules/admin/service-provider/dto/update-pay-rates-by-role.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateEmergencyBonusDto } from './dto/update-emergency-bonus.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';
import { MailService } from 'src/mail/mail.service';
import { GoogleMapsService } from 'src/common/lib/GoogleMaps/GoogleMapsService';
import { UserRepository } from '../../../common/repository/user/user.repository';

@Injectable()
export class ServiceProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async create(
    createServiceProviderDto: CreateServiceProviderDto,
    brandLogo?: Express.Multer.File,
  ) {
    try {
      const email = String(createServiceProviderDto.email ?? '')
        .trim()
        .toLowerCase();
      const password = String(createServiceProviderDto.password ?? '').trim();

      if (!email) {
        throw new BadRequestException('Email is required');
      }

      if (!password) {
        throw new BadRequestException('Password is required');
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, deleted_at: true },
      });

      if (existingUser) {
        if (existingUser.deleted_at !== null) {
          await this.prisma.user.delete({
            where: { id: existingUser.id },
          });
        } else {
          throw new BadRequestException('Email already exists');
        }
      }

      let brandLogoFileName: string | undefined = undefined;
      if (brandLogo) {
        brandLogoFileName = `${StringHelper.randomString()}${brandLogo.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.brand + brandLogoFileName,
          brandLogo.buffer,
        );
      }

      const maxClientCapacity = Number(
        createServiceProviderDto.max_client_capacity,
      );
      if (Number.isNaN(maxClientCapacity) || maxClientCapacity < 1) {
        throw new BadRequestException('Max client capacity must be at least 1');
      }

      const agreedToTerms =
        typeof createServiceProviderDto.agreed_to_terms === 'string'
          ? ['true', '1', 'yes'].includes(
              String(createServiceProviderDto.agreed_to_terms)
                .trim()
                .toLowerCase(),
            )
          : !!createServiceProviderDto.agreed_to_terms;

      const hashedPassword = await bcrypt.hash(
        password,
        appConfig().security.salt,
      );

      const serviceProviderRole = await this.prisma.role.findFirst({
        where: { name: 'service_provider' },
      });

      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            type: 'service_provider',
            status: 1,
            approved_at: new Date(),
            email_verified_at: new Date(),
            onboarding_step: 'completed',
          },
        });

        if (serviceProviderRole) {
          await tx.roleUser.create({
            data: {
              user_id: user.id,
              role_id: serviceProviderRole.id,
            },
          });
        }

        let latitude: number | null = null;
        let longitude: number | null = null;
        let postcode: string | null = null;

        if (createServiceProviderDto.primary_address) {
          try {
            const geocodeResult = await GoogleMapsService.geocodeAddress(
              createServiceProviderDto.primary_address,
            );
            if (geocodeResult) {
              latitude = geocodeResult.latitude;
              longitude = geocodeResult.longitude;
              postcode = geocodeResult.postcode ?? null;
            }
          } catch (error) {
            console.error('Failed to geocode provider primary address:', error);
          }
        }

        const provider = await tx.serviceProviderInfo.create({
          data: {
            user_id: user.id,
            first_name: createServiceProviderDto.first_name,
            last_name: createServiceProviderDto.last_name,
            mobile_code: createServiceProviderDto.mobile_code,
            mobile_number: createServiceProviderDto.mobile_number,
            second_mobile_code: createServiceProviderDto.second_mobile_code,
            second_mobile_number: createServiceProviderDto.second_mobile_number,
            register_manager_name:
              createServiceProviderDto.register_manager_name,
            organization_name: createServiceProviderDto.organization_name,
            website: createServiceProviderDto.website,
            cqc_provider_number: createServiceProviderDto.cqc_provider_number,
            vat_tax_id: createServiceProviderDto.vat_tax_id,
            primary_address: createServiceProviderDto.primary_address,
            latitude,
            longitude,
            postcode,
            main_service_type:
              createServiceProviderDto.main_service_type as any,
            max_client_capacity: maxClientCapacity,
            brand_logo_url: brandLogoFileName ?? undefined,
            agreed_to_terms: agreedToTerms,
          },
        });

        return { user, provider };
      });

      try {
        const stripeCustomer = await StripePayment.createCustomer({
          user_id: result.user.id,
          email: result.user.email,
          name: `${createServiceProviderDto.first_name} ${createServiceProviderDto.last_name}`,
        });

        if (stripeCustomer?.id) {
          await this.prisma.user.update({
            where: { id: result.user.id },
            data: { billing_id: stripeCustomer.id },
          });
        }
      } catch (stripeError) {
        console.error(
          'Failed to create Stripe customer for service provider:',
          (stripeError as any)?.message,
        );
      }

      // Send email notification to info@vitalhands.co.uk
      try {
        await this.mailService.sendNewProviderNotification({
          providerName: `${createServiceProviderDto.first_name} ${createServiceProviderDto.last_name}`,
          organizationName: createServiceProviderDto.organization_name,
          providerEmail: email,
          cqcNumber: createServiceProviderDto.cqc_provider_number,
          serviceType: createServiceProviderDto.main_service_type,
        });
      } catch (mailError) {
        console.error(
          'Failed to send new provider email notification:',
          mailError,
        );
      }

      // Send login credentials to the newly created service provider
      try {
        await this.mailService.sendUserCredentials({
          email: result.user.email,
          name: `${createServiceProviderDto.first_name} ${createServiceProviderDto.last_name}`,
          password: password,
          accountType: 'service provider',
        });
      } catch (mailError) {
        console.error(
          'Failed to send service provider credentials email:',
          mailError,
        );
      }

      return {
        success: true,
        message: 'Service provider created successfully',
        data: {
          user_id: result.user.id,
          service_provider_info_id: result.provider.id,
          onboarding_step: 'completed',
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to create service provider',
      );
    }
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
      const andConditions: any[] = [
        // Exclude soft-deleted service providers
        { user: { deleted_at: null } },
      ];

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
            latitude: true,
            longitude: true,
            postcode: true,
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
              deleted_at: true,
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
      if (provider.user?.deleted_at)
        throw new NotFoundException('Service provider not found');

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

  async update(
    id: string,
    updateServiceProviderDto: UpdateServiceProviderDto,
    brandLogo?: Express.Multer.File,
  ) {
    try {
      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!provider) throw new NotFoundException('Service provider not found');

      const existingLogo = provider.brand_logo_url;
      const existingUserEmail = provider.user?.email;

      let brandLogoFileName: string | undefined = undefined;
      if (brandLogo) {
        if (existingLogo) {
          try {
            await SojebStorage.delete(
              appConfig().storageUrl.brand + existingLogo,
            );
          } catch (err) {
            console.error('Failed to delete old brand logo:', err);
          }
        }

        brandLogoFileName = `${StringHelper.randomString()}${brandLogo.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.brand + brandLogoFileName,
          brandLogo.buffer,
        );
      }

      const updatePayload: any = {};

      if (updateServiceProviderDto.first_name !== undefined) {
        updatePayload.first_name = updateServiceProviderDto.first_name;
      }
      if (updateServiceProviderDto.last_name !== undefined) {
        updatePayload.last_name = updateServiceProviderDto.last_name;
      }
      if (updateServiceProviderDto.mobile_code !== undefined) {
        updatePayload.mobile_code = updateServiceProviderDto.mobile_code;
      }
      if (updateServiceProviderDto.mobile_number !== undefined) {
        updatePayload.mobile_number = updateServiceProviderDto.mobile_number;
      }
      if (updateServiceProviderDto.organization_name !== undefined) {
        updatePayload.organization_name =
          updateServiceProviderDto.organization_name;
      }
      if (updateServiceProviderDto.website !== undefined) {
        updatePayload.website = updateServiceProviderDto.website;
      }
      if (updateServiceProviderDto.cqc_provider_number !== undefined) {
        updatePayload.cqc_provider_number =
          updateServiceProviderDto.cqc_provider_number;
      }
      if (updateServiceProviderDto.vat_tax_id !== undefined) {
        updatePayload.vat_tax_id = updateServiceProviderDto.vat_tax_id;
      }
      if (updateServiceProviderDto.primary_address !== undefined) {
        updatePayload.primary_address =
          updateServiceProviderDto.primary_address;

        if (updateServiceProviderDto.primary_address) {
          try {
            const geocodeResult = await GoogleMapsService.geocodeAddress(
              updateServiceProviderDto.primary_address,
            );
            if (geocodeResult) {
              updatePayload.latitude = geocodeResult.latitude;
              updatePayload.longitude = geocodeResult.longitude;
              updatePayload.postcode = geocodeResult.postcode ?? null;
            } else {
              updatePayload.latitude = null;
              updatePayload.longitude = null;
              updatePayload.postcode = null;
            }
          } catch (error) {
            console.error(
              'Failed to geocode provider primary address during update:',
              error,
            );
          }
        } else {
          updatePayload.latitude = null;
          updatePayload.longitude = null;
          updatePayload.postcode = null;
        }
      }
      if (updateServiceProviderDto.main_service_type !== undefined) {
        updatePayload.main_service_type =
          updateServiceProviderDto.main_service_type as any;
      }
      if (updateServiceProviderDto.max_client_capacity !== undefined) {
        const cap = Number(updateServiceProviderDto.max_client_capacity);
        if (Number.isNaN(cap) || cap < 1) {
          throw new BadRequestException(
            'Max client capacity must be at least 1',
          );
        }
        updatePayload.max_client_capacity = cap;
      }

      if (brandLogoFileName !== undefined) {
        updatePayload.brand_logo_url = brandLogoFileName;
      }

      if (updateServiceProviderDto.second_mobile_code !== undefined) {
        updatePayload.second_mobile_code =
          updateServiceProviderDto.second_mobile_code;
      }

      if (updateServiceProviderDto.second_mobile_number !== undefined) {
        updatePayload.second_mobile_number =
          updateServiceProviderDto.second_mobile_number;
      }

      if (updateServiceProviderDto.register_manager_name !== undefined) {
        updatePayload.register_manager_name =
          updateServiceProviderDto.register_manager_name;
      }

      const agreedToTerms =
        typeof updateServiceProviderDto.agreed_to_terms === 'string'
          ? ['true', '1', 'yes'].includes(
              String(updateServiceProviderDto.agreed_to_terms)
                .trim()
                .toLowerCase(),
            )
          : updateServiceProviderDto.agreed_to_terms;

      if (agreedToTerms !== undefined) {
        updatePayload.agreed_to_terms = !!agreedToTerms;
      }

      const result = await this.prisma.$transaction(async (tx) => {
        if (
          updateServiceProviderDto.email !== undefined &&
          String(updateServiceProviderDto.email).trim().toLowerCase() !==
            existingUserEmail?.toLowerCase()
        ) {
          const emailExists = await tx.user.findUnique({
            where: {
              email: String(updateServiceProviderDto.email)
                .trim()
                .toLowerCase(),
            },
            select: { id: true },
          });

          if (emailExists && emailExists.id !== provider.user.id) {
            throw new BadRequestException('Email already exists');
          }

          await tx.user.update({
            where: { id: provider.user.id },
            data: {
              email: String(updateServiceProviderDto.email)
                .trim()
                .toLowerCase(),
            },
          });
        }

        if (updateServiceProviderDto.password !== undefined) {
          const hashed = await bcrypt.hash(
            String(updateServiceProviderDto.password),
            appConfig().security.salt,
          );

          await tx.user.update({
            where: { id: provider.user.id },
            data: { password: hashed },
          });
        }

        const updatedProvider = await tx.serviceProviderInfo.update({
          where: { id },
          data: updatePayload,
          select: {
            id: true,
            user_id: true,
            organization_name: true,
            brand_logo_url: true,
            updated_at: true,
          },
        });

        return { updatedProvider };
      });

      return {
        success: true,
        message: 'Service provider updated successfully',
        data: result.updatedProvider,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed to update service provider',
      );
    }
  }

  async remove(id: string) {
    try {
      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id },
        select: { id: true, user_id: true },
      });

      if (!provider) {
        throw new NotFoundException('Service provider not found');
      }

      await this.prisma.$transaction(async (tx) => {
        await UserRepository.hardDeleteUser(provider.user_id, tx);
      });

      return {
        success: true,
        message: 'Service provider deleted successfully',
        data: {
          id: provider.id,
          user_id: provider.user_id,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to delete service provider',
      );
    }
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

      const platformMargin =
        dto.platform_margin !== undefined
          ? Number(dto.platform_margin)
          : undefined;

      const updated = await (this.prisma as any).providerPayRateByRole.upsert({
        where: {
          service_provider_id_profession_role: {
            service_provider_id: id,
            profession_role: dto.profession_role,
          },
        },
        update: {
          pay_rate_hourly: payRate,
          platform_margin: platformMargin,
        },
        create: {
          service_provider_id: id,
          profession_role: dto.profession_role,
          pay_rate_hourly: payRate,
          platform_margin: platformMargin ?? 0,
        },
        select: {
          id: true,
          profession_role: true,
          pay_rate_hourly: true,
          platform_margin: true,
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

  async updatePayRatesByRole(id: string, dto: UpdatePayRatesByRoleDto) {
    try {
      const provider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!provider) throw new NotFoundException('Service provider not found');

      const seenRoles = new Set<string>();
      for (const item of dto.pay_rates) {
        const roleKey = String(item.profession_role);
        if (seenRoles.has(roleKey)) {
          throw new BadRequestException(
            `Duplicate role in payload: ${roleKey}`,
          );
        }
        seenRoles.add(roleKey);
      }

      const results = await this.prisma.$transaction(
        dto.pay_rates.map((item) => {
          const payRate = Number(item.pay_rate_hourly);
          if (Number.isNaN(payRate) || payRate <= 0) {
            throw new BadRequestException(
              'Pay rate hourly must be greater than 0',
            );
          }

          const platformMargin =
            item.platform_margin !== undefined
              ? Number(item.platform_margin)
              : undefined;

          return (this.prisma as any).providerPayRateByRole.upsert({
            where: {
              service_provider_id_profession_role: {
                service_provider_id: id,
                profession_role: item.profession_role,
              },
            },
            update: {
              pay_rate_hourly: payRate,
              platform_margin: platformMargin,
            },
            create: {
              service_provider_id: id,
              profession_role: item.profession_role,
              pay_rate_hourly: payRate,
              platform_margin: platformMargin ?? 0,
            },
            select: {
              id: true,
              profession_role: true,
              pay_rate_hourly: true,
              platform_margin: true,
              updated_at: true,
            },
          });
        }),
      );

      return {
        success: true,
        message: 'Pay rates for roles updated successfully',
        data: results,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update pay rates for roles',
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
          platform_margin: true,
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
      const andBaseCondition = {
        user: {
          deleted_at: null,
        },
      };

      const [total, pending, active, suspended] =
        await this.prisma.$transaction([
          // total (same base condition)
          this.prisma.serviceProviderInfo.count({
            where: andBaseCondition,
          }),

          // pending
          this.prisma.serviceProviderInfo.count({
            where: {
              AND: [andBaseCondition, { user: { status: 0 } }],
            },
          }),

          // active
          this.prisma.serviceProviderInfo.count({
            where: {
              AND: [andBaseCondition, { user: { status: 1 } }],
            },
          }),

          // suspended
          this.prisma.serviceProviderInfo.count({
            where: {
              AND: [andBaseCondition, { user: { status: 2 } }],
            },
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
