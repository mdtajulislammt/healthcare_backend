import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const user = await UserRepository.createUser(createUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async createAdminUser(createAdminUserDto: CreateAdminUserDto) {
    try {
      const email = String(createAdminUserDto.email ?? '').trim();
      const password = String(createAdminUserDto.password ?? '').trim();

      if (!email) {
        throw new BadRequestException('Email is required');
      }

      if (!password) {
        throw new BadRequestException('Password is required');
      }

      if (password.length < 6) {
        throw new BadRequestException('Password must be at least 6 characters');
      }

      // Check if email already exists
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

      // Hash password
      const hashedPassword = await bcrypt.hash(
        password,
        appConfig().security.salt,
      );

      // Get or create admin role
      let adminRole = await this.prisma.role.findFirst({
        where: { name: 'admin' },
      });

      if (!adminRole) {
        adminRole = await this.prisma.role.create({
          data: {
            name: 'admin',
            title: 'Administrator',
            status: 1,
          },
        });
      }

      // Create user and attach role in transaction
      const user = await this.prisma.$transaction(async (tx) => {
        // Create user
        const newUser = await tx.user.create({
          data: {
            email: email,
            password: hashedPassword,
            type: 'admin',
            status: 1,
            email_verified_at: DateHelper.now(),
            approved_at: DateHelper.now(),
          },
        });

        // Attach admin role
        await tx.roleUser.create({
          data: {
            user_id: newUser.id,
            role_id: adminRole.id,
          },
        });

        // Create admin profile
        await tx.adminProfile.create({
          data: {
            user_id: newUser.id,
            first_name: createAdminUserDto.first_name || 'Admin',
            last_name: createAdminUserDto.last_name || 'User',
          },
        });

        return newUser;
      });

      return {
        success: true,
        message: 'Admin user created successfully',
        data: {
          id: user.id,
          email: user.email,
          type: user.type,
          status: user.status,
        },
      };
    } catch (error) {
      const message =
        error instanceof BadRequestException
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to create admin user';

      return {
        success: false,
        message: message,
      };
    }
  }

  async deleteAdminUser(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true, type: true },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.type !== 'admin') {
        throw new BadRequestException('User is not an admin');
      }

      // Delete in transaction to mimic creation flow
      await this.prisma.$transaction(async (tx) => {
        // Delete role users connection
        await tx.roleUser.deleteMany({
          where: { user_id: id },
        });

        // Delete admin profile
        await tx.adminProfile.deleteMany({
          where: { user_id: id },
        });

        // Delete user
        await tx.user.delete({
          where: { id },
        });
      });

      return {
        success: true,
        message: 'Admin user deleted successfully',
      };
    } catch (error) {
      const message =
        error instanceof BadRequestException
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to delete admin user';

      return {
        success: false,
        message: message,
      };
    }
  }

  async findAllAdmins() {
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          type: 'admin',
          deleted_at: null,
        },
        select: {
          id: true,
          email: true,
          type: true,
          status: true,
          created_at: true,
          updated_at: true,
          admin_profile: {
            select: {
              first_name: true,
              last_name: true,
              photo_url: true,
              mobile_code: true,
              mobile_number: true,
              date_of_birth: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      const formattedAdmins = admins.map((admin) => {
        let avatar_url = null;
        if (admin.admin_profile?.photo_url) {
          avatar_url = SojebStorage.url(
            appConfig().storageUrl.avatar + admin.admin_profile.photo_url,
          );
        }

        return {
          id: admin.id,
          email: admin.email,
          type: admin.type,
          status: admin.status,
          first_name: admin.admin_profile?.first_name || '',
          last_name: admin.admin_profile?.last_name || '',
          mobile_code: admin.admin_profile?.mobile_code || null,
          mobile_number: admin.admin_profile?.mobile_number || null,
          date_of_birth: admin.admin_profile?.date_of_birth || null,
          avatar_url,
          created_at: admin.created_at,
          updated_at: admin.updated_at,
        };
      });

      return {
        success: true,
        message: 'Admin users fetched successfully',
        data: formattedAdmins,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to fetch admin users',
      };
    }
  }

  async findAll({
    page = 1,
    limit = 10,
    search,
    q,
    type,
    status,
    approved,
    is_verified,
    from_date,
    to_date,
    sort_by = 'created_at',
    sort_order = 'desc',
  }: {
    page?: number;
    limit?: number;
    search?: string;
    q?: string;
    type?: string;
    status?: string | number;
    approved?: string;
    is_verified?: string | boolean;
    from_date?: string;
    to_date?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}) {
    try {
      const currentPage = Math.max(Number(page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
      const skip = (currentPage - 1) * pageSize;

      const andConditions: Prisma.UserWhereInput[] = [
        { deleted_at: null },
      ];

      const searchTerm = (search || q || '').trim();
      if (searchTerm) {
        andConditions.push({
          OR: [
            { email: { contains: searchTerm, mode: 'insensitive' } },
            {
              staff_profile: {
                OR: [
                  { first_name: { contains: searchTerm, mode: 'insensitive' } },
                  { last_name: { contains: searchTerm, mode: 'insensitive' } },
                  { mobile_number: { contains: searchTerm, mode: 'insensitive' } },
                ],
              },
            },
            {
              service_provider_info: {
                OR: [
                  { organization_name: { contains: searchTerm, mode: 'insensitive' } },
                  { first_name: { contains: searchTerm, mode: 'insensitive' } },
                  { last_name: { contains: searchTerm, mode: 'insensitive' } },
                  { mobile_number: { contains: searchTerm, mode: 'insensitive' } },
                  { cqc_provider_number: { contains: searchTerm, mode: 'insensitive' } },
                ],
              },
            },
            {
              admin_profile: {
                OR: [
                  { first_name: { contains: searchTerm, mode: 'insensitive' } },
                  { last_name: { contains: searchTerm, mode: 'insensitive' } },
                  { mobile_number: { contains: searchTerm, mode: 'insensitive' } },
                ],
              },
            },
          ],
        });
      }

      if (type && type.toLowerCase() !== 'all') {
        andConditions.push({ type: type.trim() });
      }

      if (
        status !== undefined &&
        status !== null &&
        status !== '' &&
        String(status).toLowerCase() !== 'all'
      ) {
        const statusStr = String(status).toLowerCase().trim();
        let statusVal: number | undefined;
        if (statusStr === 'active' || statusStr === '1') statusVal = 1;
        else if (statusStr === 'pending' || statusStr === '0') statusVal = 0;
        else if (statusStr === 'suspended' || statusStr === '2') statusVal = 2;
        else if (!isNaN(Number(statusStr))) statusVal = Number(statusStr);

        if (statusVal !== undefined) {
          andConditions.push({ status: statusVal });
        }
      }

      if (approved && approved.toLowerCase() !== 'all') {
        const app = approved.toLowerCase().trim();
        if (app === 'approved' || app === 'true' || app === '1') {
          andConditions.push({ approved_at: { not: null } });
        } else if (
          app === 'pending' ||
          app === 'unapproved' ||
          app === 'false' ||
          app === '0'
        ) {
          andConditions.push({ approved_at: null });
        }
      }

      if (
        is_verified !== undefined &&
        is_verified !== null &&
        is_verified !== '' &&
        String(is_verified).toLowerCase() !== 'all'
      ) {
        const verStr = String(is_verified).toLowerCase().trim();
        if (verStr === 'true' || verStr === '1' || verStr === 'verified') {
          andConditions.push({ email_verified_at: { not: null } });
        } else if (
          verStr === 'false' ||
          verStr === '0' ||
          verStr === 'unverified'
        ) {
          andConditions.push({ email_verified_at: null });
        }
      }

      if (from_date || to_date) {
        const createdAtCondition: Prisma.DateTimeFilter = {};
        if (from_date) {
          createdAtCondition.gte = new Date(from_date);
        }
        if (to_date) {
          const to = new Date(to_date);
          if (!to_date.includes('T')) {
            to.setHours(23, 59, 59, 999);
          }
          createdAtCondition.lte = to;
        }
        andConditions.push({ created_at: createdAtCondition });
      }

      const where: Prisma.UserWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

      const allowedSortFields: Record<string, string> = {
        created_at: 'created_at',
        updated_at: 'updated_at',
        email: 'email',
        type: 'type',
        status: 'status',
        approved_at: 'approved_at',
      };

      const orderByField =
        allowedSortFields[sort_by || 'created_at'] || 'created_at';
      const orderDirection =
        sort_order?.toLowerCase() === 'asc' ? 'asc' : 'desc';
      const orderBy = { [orderByField]: orderDirection };

      const [total, users] = await this.prisma.$transaction([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            type: true,
            status: true,
            approved_at: true,
            email_verified_at: true,
            onboarding_step: true,
            billing_id: true,
            is_two_factor_enabled: true,
            push_notification_enabled: true,
            created_at: true,
            updated_at: true,
            staff_profile: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                photo_url: true,
                mobile_code: true,
                mobile_number: true,
                gender: true,
                roles: true,
                right_to_work_status: true,
                profile_completion: true,
                is_profile_complete: true,
                can_apply_to_shifts: true,
              },
            },
            service_provider_info: {
              select: {
                id: true,
                organization_name: true,
                first_name: true,
                last_name: true,
                brand_logo_url: true,
                mobile_code: true,
                mobile_number: true,
                main_service_type: true,
                facility_name: true,
                cqc_provider_number: true,
                primary_address: true,
                postcode: true,
              },
            },
            admin_profile: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                photo_url: true,
                mobile_code: true,
                mobile_number: true,
              },
            },
            role_users: {
              select: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    title: true,
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

      const formattedUsers = users.map((user) => {
        let name: string | null = null;
        let avatar_url: string | null = null;
        let mobile_code: string | null = null;
        let mobile_number: string | null = null;

        if (user.type === 'staff' && user.staff_profile) {
          name =
            `${user.staff_profile.first_name || ''} ${user.staff_profile.last_name || ''}`.trim() ||
            null;
          mobile_code = user.staff_profile.mobile_code;
          mobile_number = user.staff_profile.mobile_number;
          if (user.staff_profile.photo_url) {
            avatar_url = SojebStorage.url(
              appConfig().storageUrl.staff + user.staff_profile.photo_url,
            );
          }
        } else if (
          user.type === 'service_provider' &&
          user.service_provider_info
        ) {
          name =
            user.service_provider_info.organization_name ||
            `${user.service_provider_info.first_name || ''} ${user.service_provider_info.last_name || ''}`.trim() ||
            null;
          mobile_code = user.service_provider_info.mobile_code;
          mobile_number = user.service_provider_info.mobile_number;
          if (user.service_provider_info.brand_logo_url) {
            avatar_url = SojebStorage.url(
              appConfig().storageUrl.brand +
                user.service_provider_info.brand_logo_url,
            );
          }
        } else if (user.type === 'admin') {
          if (user.admin_profile) {
            name =
              `${user.admin_profile.first_name || ''} ${user.admin_profile.last_name || ''}`.trim() ||
              'Admin';
            mobile_code = user.admin_profile.mobile_code;
            mobile_number = user.admin_profile.mobile_number;
            if (user.admin_profile.photo_url) {
              avatar_url = SojebStorage.url(
                appConfig().storageUrl.avatar + user.admin_profile.photo_url,
              );
            }
          } else {
            name = user.email || 'Admin';
          }
        } else {
          name = user.email || 'User';
        }

        const roles =
          user.role_users?.map((ru) => ru.role).filter(Boolean) || [];

        return {
          id: user.id,
          email: user.email,
          type: user.type,
          status: user.status,
          name,
          avatar_url,
          mobile_code,
          mobile_number,
          approved_at: user.approved_at,
          is_approved: !!user.approved_at,
          email_verified_at: user.email_verified_at,
          is_email_verified: !!user.email_verified_at,
          onboarding_step: user.onboarding_step,
          is_two_factor_enabled: !!user.is_two_factor_enabled,
          push_notification_enabled: user.push_notification_enabled,
          created_at: user.created_at,
          updated_at: user.updated_at,
          roles,
          staff_profile: user.staff_profile
            ? {
                ...user.staff_profile,
                photo_url: avatar_url,
              }
            : null,
          service_provider_info: user.service_provider_info
            ? {
                ...user.service_provider_info,
                brand_logo_url: avatar_url,
              }
            : null,
          admin_profile: user.admin_profile
            ? {
                ...user.admin_profile,
                photo_url: avatar_url,
              }
            : null,
        };
      });

      return {
        success: true,
        message: 'Users fetched successfully',
        data: formattedUsers,
        meta: {
          total,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to fetch users',
      };
    }
  }

  async findOne(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: id,
        },
        select: {
          id: true,
          email: true,
          type: true,
          status: true,
          approved_at: true,
          email_verified_at: true,
          onboarding_step: true,
          billing_id: true,
          is_two_factor_enabled: true,
          push_notification_enabled: true,
          created_at: true,
          updated_at: true,
          staff_profile: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              photo_url: true,
              mobile_code: true,
              mobile_number: true,
              gender: true,
              roles: true,
              right_to_work_status: true,
              profile_completion: true,
              is_profile_complete: true,
              can_apply_to_shifts: true,
              admin_note: true,
            },
          },
          service_provider_info: {
            select: {
              id: true,
              organization_name: true,
              first_name: true,
              last_name: true,
              brand_logo_url: true,
              mobile_code: true,
              mobile_number: true,
              second_mobile_code: true,
              second_mobile_number: true,
              main_service_type: true,
              facility_name: true,
              cqc_provider_number: true,
              vat_tax_id: true,
              website: true,
              primary_address: true,
              postcode: true,
              max_client_capacity: true,
            },
          },
          admin_profile: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              photo_url: true,
              mobile_code: true,
              mobile_number: true,
              date_of_birth: true,
            },
          },
          role_users: {
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      let name: string | null = null;
      let avatar_url: string | null = null;
      let mobile_code: string | null = null;
      let mobile_number: string | null = null;

      if (user.type === 'staff' && user.staff_profile) {
        name =
          `${user.staff_profile.first_name || ''} ${user.staff_profile.last_name || ''}`.trim() ||
          null;
        mobile_code = user.staff_profile.mobile_code;
        mobile_number = user.staff_profile.mobile_number;
        if (user.staff_profile.photo_url) {
          avatar_url = SojebStorage.url(
            appConfig().storageUrl.staff + user.staff_profile.photo_url,
          );
        }
      } else if (
        user.type === 'service_provider' &&
        user.service_provider_info
      ) {
        name =
          user.service_provider_info.organization_name ||
          `${user.service_provider_info.first_name || ''} ${user.service_provider_info.last_name || ''}`.trim() ||
          null;
        mobile_code = user.service_provider_info.mobile_code;
        mobile_number = user.service_provider_info.mobile_number;
        if (user.service_provider_info.brand_logo_url) {
          avatar_url = SojebStorage.url(
            appConfig().storageUrl.brand +
              user.service_provider_info.brand_logo_url,
          );
        }
      } else if (user.type === 'admin') {
        if (user.admin_profile) {
          name =
            `${user.admin_profile.first_name || ''} ${user.admin_profile.last_name || ''}`.trim() ||
            'Admin';
          mobile_code = user.admin_profile.mobile_code;
          mobile_number = user.admin_profile.mobile_number;
          if (user.admin_profile.photo_url) {
            avatar_url = SojebStorage.url(
              appConfig().storageUrl.avatar + user.admin_profile.photo_url,
            );
          }
        } else {
          name = user.email || 'Admin';
        }
      } else {
        name = user.email || 'User';
      }

      const roles =
        user.role_users?.map((ru) => ru.role).filter(Boolean) || [];

      const formattedUser = {
        id: user.id,
        email: user.email,
        type: user.type,
        status: user.status,
        name,
        avatar_url,
        mobile_code,
        mobile_number,
        approved_at: user.approved_at,
        is_approved: !!user.approved_at,
        email_verified_at: user.email_verified_at,
        is_email_verified: !!user.email_verified_at,
        onboarding_step: user.onboarding_step,
        is_two_factor_enabled: !!user.is_two_factor_enabled,
        push_notification_enabled: user.push_notification_enabled,
        billing_id: user.billing_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
        roles,
        staff_profile: user.staff_profile
          ? {
              ...user.staff_profile,
              photo_url: avatar_url,
            }
          : null,
        service_provider_info: user.service_provider_info
          ? {
              ...user.service_provider_info,
              brand_logo_url: avatar_url,
            }
          : null,
        admin_profile: user.admin_profile
          ? {
              ...user.admin_profile,
              photo_url: avatar_url,
            }
          : null,
      };

      return {
        success: true,
        data: formattedUser,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to fetch user',
      };
    }
  }

  async approve(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      await this.prisma.user.update({
        where: { id: id },
        data: { approved_at: DateHelper.now() },
      });
      return {
        success: true,
        message: 'User approved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to approve user',
      };
    }
  }

  async reject(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      await this.prisma.user.update({
        where: { id: id },
        data: { approved_at: null },
      });
      return {
        success: true,
        message: 'User rejected successfully',
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to reject user',
      };
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await UserRepository.updateUser(id, updateUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to update user',
      };
    }
  }

  async remove(id: string, permanent: boolean = true) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (permanent) {
        await this.prisma.$transaction(async (tx) => {
          await UserRepository.hardDeleteUser(id, tx);
        });

        return {
          success: true,
          message: `User (${user.email}) permanently deleted successfully`,
        };
      } else {
        await this.prisma.user.update({
          where: { id },
          data: {
            deleted_at: DateHelper.now(),
            status: 0,
          },
        });

        return {
          success: true,
          message: `User (${user.email}) soft-deleted successfully`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to remove user',
      };
    }
  }
}
