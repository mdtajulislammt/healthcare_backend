import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PushNotificationService } from 'src/common/service/push-notification.service';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async registerDevice(userId: string, token: string, platform: string) {
    // Upsert by token so the same device can be re-linked if user changes
    return this.prisma.userDeviceToken.upsert({
      where: { token },
      create: {
        user_id: userId,
        token,
        platform,
      },
      update: {
        user_id: userId,
        platform,
      },
    });
  }

  async unregisterDevice(token: string) {
    await this.prisma.userDeviceToken.deleteMany({
      where: { token },
    });
  }

  async testPushNotification(userId: string, title?: string, body?: string) {
    // Check if user has any registered devices
    const devices = await this.prisma.userDeviceToken.findMany({
      where: { user_id: userId },
      select: { token: true, platform: true },
    });

    if (!devices.length) {
      return {
        success: false,
        message: 'No device registered. Please register your device first using /application/devices/register',
        data: {
          devices_count: 0,
        },
      };
    }

    try {
      const notificationTitle = title || 'Test Notification';
      const notificationBody = body || 'This is a test push notification from backend!';

      // Save notification to database
      await NotificationRepository.createNotification({
        receiver_id: userId,
        text: notificationBody,
        type: 'message',
      });

      // Send push notification
      await this.pushNotificationService.sendToUser(userId, {
        title: notificationTitle,
        body: notificationBody,
        data: { type: 'test', timestamp: new Date().toISOString() },
      });

      return {
        success: true,
        message: 'Test notification sent successfully',
        data: {
          devices_count: devices.length,
          platforms: devices.map((d) => d.platform),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send push notification',
        error: error.message || 'Unknown error',
      };
    }
  }

  async getPushNotificationStatus(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { push_notification_enabled: true },
      });

      return {
        success: true,
        data: {
          push_notification_enabled: user?.push_notification_enabled ?? true,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get push notification status',
        error: error.message || 'Unknown error',
      };
    }
  }

  async togglePushNotification(userId: string, enabled: boolean) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { push_notification_enabled: enabled },
      });

      return {
        success: true,
        message: `Push notifications ${enabled ? 'enabled' : 'disabled'} successfully`,
        data: {
          push_notification_enabled: enabled,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to toggle push notification',
        error: error.message || 'Unknown error',
      };
    }
  }
}


