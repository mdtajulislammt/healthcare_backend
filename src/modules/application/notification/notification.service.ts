import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, options?: { page?: number; limit?: number }) {
    try {
      const currentPage = Math.max(Number(options?.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(options?.limit) || 20, 1), 100);
      const skip = (currentPage - 1) * pageSize;

      const where = {
        receiver_id: userId,
        deleted_at: null,
      };

      const [total, notifications, unreadCount] =
        await this.prisma.$transaction([
          this.prisma.notification.count({ where }),
          this.prisma.notification.findMany({
            where,
            select: {
              id: true,
              read_at: true,
              entity_id: true,
              created_at: true,
              notification_event: {
                select: {
                  id: true,
                  type: true,
                  text: true,
                },
              },
              sender: {
                select: {
                  id: true,
                  staff_profile: {
                    select: {
                      first_name: true,
                      last_name: true,
                      photo_url: true,
                    },
                  },
                  service_provider_info: {
                    select: {
                      first_name: true,
                      last_name: true,
                      brand_logo_url: true,
                    },
                  },
                },
              },
            },
            orderBy: { created_at: 'desc' },
            skip,
            take: pageSize,
          }),
          this.prisma.notification.count({
            where: {
              ...where,
              read_at: null,
            },
          }),
        ]);

      return {
        success: true,
        message: 'Notifications fetched successfully',
        data: notifications,
        meta: {
          total,
          unread_count: unreadCount,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch notifications');
    }
  }

  async markAsRead(userId: string, notificationId: string) {
    try {
      const notification = await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          receiver_id: userId,
        },
        data: {
          read_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'Notification marked as read',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to mark notification as read',
      );
    }
  }

  async markAllAsRead(userId: string) {
    try {
      await this.prisma.notification.updateMany({
        where: {
          receiver_id: userId,
          read_at: null,
        },
        data: {
          read_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'All notifications marked as read',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to mark all notifications as read',
      );
    }
  }

  async getUnreadCount(userId: string) {
    try {
      const count = await this.prisma.notification.count({
        where: {
          receiver_id: userId,
          read_at: null,
          deleted_at: null,
        },
      });

      return {
        success: true,
        data: {
          unread_count: count,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to get unread count');
    }
  }

  async deleteNotification(userId: string, notificationId: string) {
    try {
      const notification = await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          receiver_id: userId,
        },
        data: {
          deleted_at: new Date(),
        },
      });

      if (notification.count === 0) {
        throw new InternalServerErrorException(
          'Notification not found or unauthorized',
        );
      }

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to delete notification');
    }
  }

  async deleteAllNotifications(userId: string) {
    try {
      await this.prisma.notification.updateMany({
        where: {
          receiver_id: userId,
          deleted_at: null,
        },
        data: {
          deleted_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'All notifications deleted successfully',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to delete all notifications',
      );
    }
  }
}
