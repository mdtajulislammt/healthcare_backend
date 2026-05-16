import { Injectable, BadRequestException } from '@nestjs/common';
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
      const email = String(createAdminUserDto.email ?? '')
        .trim()
        .toLowerCase();
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
        select: { id: true },
      });

      if (existingUser) {
        throw new BadRequestException('Email already exists');
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

  async findAll({
    q,
    type,
    approved,
  }: {
    q?: string;
    type?: string;
    approved?: string;
  }) {
    try {
      const where_condition = {};
      if (q) {
        where_condition['OR'] = [
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }

      if (type) {
        where_condition['type'] = type;
      }

      if (approved) {
        where_condition['approved_at'] =
          approved == 'approved' ? { not: null } : { equals: null };
      }

      const users = await this.prisma.user.findMany({
        where: {
          ...where_condition,
        },
        select: {
          id: true,
          email: true,
          type: true,
          approved_at: true,
          created_at: true,
          updated_at: true,
          staff_profile: {
            select: {
              first_name: true,
              last_name: true,
              photo_url: true,
            },
          },
          service_provider_info: {
            select: {
              organization_name: true,
              brand_logo_url: true,
            },
          },
        },
      });

      // Format user data with name and avatar based on type
      const formattedUsers = users.map((user) => {
        let name = null;
        let avatar_url = null;

        if (user.type === 'staff' && user.staff_profile) {
          name = `${user.staff_profile.first_name} ${user.staff_profile.last_name}`;
          if (user.staff_profile.photo_url) {
            avatar_url = SojebStorage.url(
              appConfig().storageUrl.staff + user.staff_profile.photo_url,
            );
          }
        } else if (
          user.type === 'service_provider' &&
          user.service_provider_info
        ) {
          name = user.service_provider_info.organization_name;
          if (user.service_provider_info.brand_logo_url) {
            avatar_url = SojebStorage.url(
              appConfig().storageUrl.brand +
                user.service_provider_info.brand_logo_url,
            );
          }
        } else if (user.type === 'admin') {
          name = user.email || 'Admin';
        }

        return {
          id: user.id,
          email: user.email,
          type: user.type,
          name: name,
          avatar_url: avatar_url,
          approved_at: user.approved_at,
          created_at: user.created_at,
          updated_at: user.updated_at,
        };
      });

      return {
        success: true,
        data: formattedUsers,
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
          approved_at: true,
          created_at: true,
          updated_at: true,
          billing_id: true,
          staff_profile: {
            select: {
              first_name: true,
              last_name: true,
              photo_url: true,
            },
          },
          service_provider_info: {
            select: {
              organization_name: true,
              brand_logo_url: true,
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

      // Format user data with name and avatar based on type
      let name = null;
      let avatar_url = null;

      if (user.type === 'staff' && user.staff_profile) {
        name = `${user.staff_profile.first_name} ${user.staff_profile.last_name}`;
        if (user.staff_profile.photo_url) {
          avatar_url = SojebStorage.url(
            appConfig().storageUrl.staff + user.staff_profile.photo_url,
          );
        }
      } else if (
        user.type === 'service_provider' &&
        user.service_provider_info
      ) {
        name = user.service_provider_info.organization_name;
        if (user.service_provider_info.brand_logo_url) {
          avatar_url = SojebStorage.url(
            appConfig().storageUrl.brand +
              user.service_provider_info.brand_logo_url,
          );
        }
      } else if (user.type === 'admin') {
        name = user.email || 'Admin';
      }

      const formattedUser = {
        id: user.id,
        email: user.email,
        type: user.type,
        name: name,
        avatar_url: avatar_url,
        approved_at: user.approved_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        billing_id: user.billing_id,
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

  async remove(id: string) {
    try {
      const user = await UserRepository.deleteUser(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to remove user',
      };
    }
  }
}
