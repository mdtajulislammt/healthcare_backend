import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as admin from 'firebase-admin';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('FIREBASE_ADMIN') private readonly firebaseApp: admin.app.App,
  ) {}

  /**
   * Send a push notification to all devices registered for a user.
   */
  async sendToUser(userId: string, payload: PushNotificationPayload) {
    try {
      const devices = await this.prisma.userDeviceToken.findMany({
        where: { user_id: userId },
        select: { token: true },
      });

      if (!devices.length) {
        this.logger.debug(`No device tokens found for user ${userId}`);
        return;
      }

      const tokens = devices.map((d) => d.token);

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      };

      const messaging = this.firebaseApp.messaging();
      const response = await messaging.sendEachForMulticast(message);

      this.logger.log(
        `Push sent to user ${userId}. success=${response.successCount}, failed=${response.failureCount}`,
      );

      // Optionally clean up invalid tokens
      if (response.failureCount > 0) {
        const tokensToDelete: string[] = [];

        response.responses.forEach((res, idx) => {
          if (!res.success) {
            const code = (res.error as any)?.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              tokensToDelete.push(tokens[idx]);
            }
          }
        });

        if (tokensToDelete.length) {
          await this.prisma.userDeviceToken.deleteMany({
            where: { token: { in: tokensToDelete } },
          });
          this.logger.log(
            `Deleted ${tokensToDelete.length} invalid FCM tokens for user ${userId}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to send push notification to user ${userId}: ${error.message}`,
      );
    }
  }
}


