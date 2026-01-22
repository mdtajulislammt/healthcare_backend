import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { OnModuleInit } from '@nestjs/common';
import appConfig from 'src/config/app.config';
import Redis from 'ioredis';
import { PrismaService } from 'src/prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private redisPubClient: Redis;
  private redisSubClient: Redis;

  // Map to store connected clients
  private clients = new Map<string, string>(); // userId -> socketId

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.redisPubClient = new Redis({
      host: appConfig().redis.host,
      port: Number(appConfig().redis.port),
      password: appConfig().redis.password,
    });

    this.redisSubClient = new Redis({
      host: appConfig().redis.host,
      port: Number(appConfig().redis.port),
      password: appConfig().redis.password,
    });

    // Subscribe to Redis notification channel
    this.redisSubClient.on('message', (channel, message) => {
      if (channel === 'notification') {
        try {
          const data = JSON.parse(message);
          this.server.emit('receiveNotification', data);
        } catch (error) {
          console.error('Failed to parse notification data:', error);
        }
      }
    });

    this.redisSubClient.subscribe('notification', (err) => {
      if (err) {
        console.error('Failed to subscribe to notification channel:', err);
      } else {
        console.log('Successfully subscribed to notification channel');
      }
    });
  }

  afterInit(server: Server) {
    console.log('Websocket server started');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    // console.log('new connection!', client.id);
    const userId = client.handshake.query.userId as string; // User ID passed as query parameter
    if (userId) {
      this.clients.set(userId, client.id);
      console.log(`User ${userId} connected with socket ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    // console.log('client disconnected!', client.id);
    const userId = [...this.clients.entries()].find(
      ([, socketId]) => socketId === client.id,
    )?.[0];
    if (userId) {
      this.clients.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  }

  // @SubscribeMessage('joinRoom')
  // handleRoomJoin(client: Socket, room: string) {
  //   client.join(room);
  //   client.emit('joinedRoom', room);
  // }

  @SubscribeMessage('sendNotification')
  async handleNotification(@MessageBody() data: any) {
    console.log(`Received notification: ${JSON.stringify(data)}`);
    // Broadcast notification to all clients
    // this.server.emit('receiveNotification', data);

    // Emit notification to specific client
    const targetSocketId = this.clients.get(data.userId);
    if (targetSocketId) {
      await this.redisPubClient.publish('notification', JSON.stringify(data));

      // console.log(`Notification sent to user ${data.userId}`);
    } else {
      // console.log(`User ${data.userId} not connected`);
    }
  }

  // Public method for sending notifications from services/controllers
  async sendNotificationToUser(payload: {
    userId: string;
    title?: string;
    body?: string;
    data?: Record<string, any>;
    notificationId?: string; // Optional: if provided, fetch full notification object
  }) {
    try {
      let notificationData: any;

      // If notificationId is provided, fetch the full notification with relations
      if (payload.notificationId) {
        const notification = await this.prisma.notification.findUnique({
          where: { id: payload.notificationId },
          include: {
            notification_event: true,
            sender: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        });

        notificationData = notification;
      } else {
        // Fallback to simple notification object
        notificationData = {
          userId: payload.userId,
          title: payload.title || 'Notification',
          body: payload.body || '',
          data: payload.data || {},
          timestamp: new Date().toISOString(),
        };
      }

      console.log(`Sending notification to user ${payload.userId}:`, notificationData);
      
      // Publish to Redis for all server instances to receive
      await this.redisPubClient.publish('notification', JSON.stringify(notificationData));
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }
}
