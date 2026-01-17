import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type NotificationType =
  | 'message'
  | 'comment'
  | 'review'
  | 'booking'
  | 'payment_transaction'
  | 'package'
  | 'blog'
  | 'shift_application'
  | 'shift_assigned'
  | 'shift_rejected'
  | 'shift_checkin'
  | 'shift_checkout'
  | 'timesheet_submitted'
  | 'timesheet_approved'
  | 'timesheet_rejected';

export class NotificationRepository {
  /**
   * Create a notification
   * @param sender_id - The ID of the user who fired the event
   * @param receiver_id - The ID of the user to notify
   * @param text - The text of the notification
   * @param type - The type of the notification
   * @param entity_id - The ID of the entity related to the notification
   * @returns The created notification
   */
  static async createNotification({
    sender_id,
    receiver_id,
    text,
    type,
    entity_id,
  }: {
    sender_id?: string;
    receiver_id?: string;
    text?: string;
    type?: NotificationType;
    entity_id?: string;
  }) {
    const notificationEventData = {};
    if (type) {
      notificationEventData['type'] = type;
    }
    if (text) {
      notificationEventData['text'] = text;
    }
    const notificationEvent = await prisma.notificationEvent.create({
      data: {
        type: type,
        text: text,
        ...notificationEventData,
      },
    });

    const notificationData = {};
    if (sender_id) {
      notificationData['sender_id'] = sender_id;
    }
    if (receiver_id) {
      notificationData['receiver_id'] = receiver_id;
    }
    if (entity_id) {
      notificationData['entity_id'] = entity_id;
    }

    const notification = await prisma.notification.create({
      data: {
        notification_event_id: notificationEvent.id,
        ...notificationData,
      },
    });

    return notification;
  }
}
