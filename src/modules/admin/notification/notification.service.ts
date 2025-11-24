import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { UserRepository } from 'src/common/repository/user/user.repository';
import { Role } from 'src/common/guard/role/role.enum';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) { }

  async findAll(user_id: string) {
    try {
      const where_condition = {};
      const userDetails = await UserRepository.getUserDetails(user_id);

      if (userDetails.type == Role.ADMIN) {
        where_condition['OR'] = [
          { receiver_id: { equals: user_id } },
          { receiver_id: { equals: null } },
        ];
      }
      // else if (userDetails.type == Role.VENDOR) {
      //   where_condition['receiver_id'] = user_id;
      // }

      const notifications = await this.prisma.notification.findMany({
        where: {
          ...where_condition,
        },
        select: {
          id: true,
          sender_id: true,
          receiver_id: true,
          entity_id: true,
          created_at: true,
          read_at: true,
          status: true,
          sender: {
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
          },
          receiver: {
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
          },
          notification_event: {
            select: {
              id: true,
              type: true,
              text: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      // Format notifications with name and avatar - consistent format for all types
      if (notifications.length > 0) {
        for (const notification of notifications) {
          // Format sender - consistent format
          if (notification.sender) {
            let senderName = null;
            let senderAvatar = null;

            // Check user type and get appropriate data
            if (notification.sender.type === 'staff' && notification.sender.staff_profile) {
              senderName = `${notification.sender.staff_profile.first_name} ${notification.sender.staff_profile.last_name}`;
              if (notification.sender.staff_profile.photo_url) {
                senderAvatar = SojebStorage.url(
                  appConfig().storageUrl.staff + notification.sender.staff_profile.photo_url,
                );
              }
            } else if (notification.sender.type === 'service_provider' && notification.sender.service_provider_info) {
              senderName = notification.sender.service_provider_info.organization_name;
              if (notification.sender.service_provider_info.brand_logo_url) {
                senderAvatar = SojebStorage.url(
                  appConfig().storageUrl.brand + notification.sender.service_provider_info.brand_logo_url,
                );
              }
            } else if (notification.sender.type === 'admin') {
              senderName = notification.sender.email || 'Admin';
            }

            // Replace sender with clean format (remove nested profile objects)
            (notification as any).sender = {
              id: notification.sender.id,
              email: notification.sender.email,
              type: notification.sender.type,
              name: senderName,
              avatar_url: senderAvatar,
            };
          }

          // Format receiver - consistent format
          if (notification.receiver) {
            let receiverName = null;
            let receiverAvatar = null;

            // Check user type and get appropriate data
            if (notification.receiver.type === 'staff' && notification.receiver.staff_profile) {
              receiverName = `${notification.receiver.staff_profile.first_name} ${notification.receiver.staff_profile.last_name}`;
              if (notification.receiver.staff_profile.photo_url) {
                receiverAvatar = SojebStorage.url(
                  appConfig().storageUrl.staff + notification.receiver.staff_profile.photo_url,
                );
              }
            } else if (notification.receiver.type === 'service_provider' && notification.receiver.service_provider_info) {
              receiverName = notification.receiver.service_provider_info.organization_name;
              if (notification.receiver.service_provider_info.brand_logo_url) {
                receiverAvatar = SojebStorage.url(
                  appConfig().storageUrl.brand + notification.receiver.service_provider_info.brand_logo_url,
                );
              }
            } else if (notification.receiver.type === 'admin') {
              receiverName = notification.receiver.email || 'Admin';
            }

            // Replace receiver with clean format (remove nested profile objects)
            (notification as any).receiver = {
              id: notification.receiver.id,
              email: notification.receiver.email,
              type: notification.receiver.type,
              name: receiverName,
              avatar_url: receiverAvatar,
            };
          }
        }
      }

      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string, user_id: string) {
    try {
      // check if notification exists
      const notification = await this.prisma.notification.findUnique({
        where: {
          id: id,
          // receiver_id: user_id,
        },
      });

      if (!notification) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      await this.prisma.notification.delete({
        where: {
          id: id,
        },
      });

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async removeAll(user_id: string) {
    try {
      // check if notification exists
      const notifications = await this.prisma.notification.findMany({
        where: {
          OR: [{ receiver_id: user_id }, { receiver_id: null }],
        },
      });

      if (notifications.length == 0) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      await this.prisma.notification.deleteMany({
        where: {
          OR: [{ receiver_id: user_id }, { receiver_id: null }],
        },
      });

      return {
        success: true,
        message: 'All notifications deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
