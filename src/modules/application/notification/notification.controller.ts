import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { NotificationService } from './notification.service';

@ApiTags('Application - Notification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('application/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: 'Get all notifications for the logged-in user' })
  @Get()
  findAll(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = (req.user as any)?.userId as string | undefined;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.notificationService.findAll(userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @ApiOperation({ summary: 'Get unread notification count' })
  @Get('unread-count')
  getUnreadCount(@Req() req: Request) {
    const userId = (req.user as any)?.userId as string | undefined;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.notificationService.getUnreadCount(userId);
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Patch('read-all')
  markAllAsRead(@Req() req: Request) {
    const userId = (req.user as any)?.userId as string | undefined;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.notificationService.markAllAsRead(userId);
  }

  @ApiOperation({ summary: 'Mark a notification as read' })
  @Patch(':id/read')
  markAsRead(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any)?.userId as string | undefined;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.notificationService.markAsRead(userId, id);
  }

  @ApiOperation({ summary: 'Delete a notification' })
  @Delete(':id')
  deleteNotification(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any)?.userId as string | undefined;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.notificationService.deleteNotification(userId, id);
  }

  @ApiOperation({ summary: 'Delete all notifications' })
  @Delete()
  deleteAllNotifications(@Req() req: Request) {
    const userId = (req.user as any)?.userId as string | undefined;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.notificationService.deleteAllNotifications(userId);
  }
}
