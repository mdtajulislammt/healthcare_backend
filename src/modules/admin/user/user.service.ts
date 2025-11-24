import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) { }

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
        message: error.message,
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
        } else if (user.type === 'service_provider' && user.service_provider_info) {
          name = user.service_provider_info.organization_name;
          if (user.service_provider_info.brand_logo_url) {
            avatar_url = SojebStorage.url(
              appConfig().storageUrl.brand + user.service_provider_info.brand_logo_url,
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
        message: error.message,
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
      } else if (user.type === 'service_provider' && user.service_provider_info) {
        name = user.service_provider_info.organization_name;
        if (user.service_provider_info.brand_logo_url) {
          avatar_url = SojebStorage.url(
            appConfig().storageUrl.brand + user.service_provider_info.brand_logo_url,
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
        message: error.message,
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
        message: error.message,
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
        message: error.message,
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
        message: error.message,
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
        message: error.message,
      };
    }
  }
}
