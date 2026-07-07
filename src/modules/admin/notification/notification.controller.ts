import {
  Controller,
  Get,
  Param,
  Delete,
  UseGuards,
  Req,
  Post,
  Body,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { NotificationGateway } from 'src/modules/application/notification/notification.gateway';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';

@ApiBearerAuth()
@ApiTags('Notification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/notification')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  @ApiOperation({ summary: 'Get all notifications' })
  @Get()
  async findAll(@Req() req: Request) {
    try {
      const user_id = req.user.userId;

      const notification = await this.notificationService.findAll(user_id);

      return notification;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Delete notification' })
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    try {
      const user_id = req.user.userId;
      const notification = await this.notificationService.remove(id, user_id);

      return notification;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Delete all notifications' })
  @Delete()
  async removeAll(@Req() req: Request) {
    try {
      const user_id = req.user.userId;
      const notification = await this.notificationService.removeAll(user_id);

      return notification;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({
    summary: 'Send test notification to current admin (websocket + DB)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Test Notification' },
        message: {
          type: 'string',
          example: 'This is a test admin notification',
        },
      },
    },
  })
  @Post('test')
  async sendTest(
    @Req() req: Request,
    @Body() body: { title?: string; message?: string },
  ) {
    try {
      const user_id = req.user.userId;
      const title = body?.title || 'Test Notification';
      const message = body?.message || 'This is a test admin notification';

      // Save to database first
      const notification = await NotificationRepository.createNotification({
        receiver_id: user_id,
        text: message,
        type: 'message',
      });

      // Send via WebSocket with the notification ID so it fetches full object
      await this.notificationGateway.sendNotificationToUser({
        userId: user_id,
        title,
        body: message,
        notificationId: notification.id,
        data: {
          type: 'admin_test',
        },
      });

      return {
        success: true,
        message: 'Test notification sent to admin',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}
