import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          status: 1,
          type: {
            not: 'user',
          },
        },
        select: {
          id: true,
          email: true,
          type: true,
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

      // Format users with consistent format
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
}
