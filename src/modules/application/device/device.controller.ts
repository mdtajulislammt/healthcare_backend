import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { DeviceService } from './device.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('Application - Device')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('application/devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post('register')
  async register(@Body() dto: RegisterDeviceDto, @Req() req: Request) {
    const userId = (req.user as any)?.userId as string | undefined;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    await this.deviceService.registerDevice(userId, dto.token, dto.platform);

    return {
      success: true,
      message: 'Device registered successfully',
    };
  }

  @Delete('unregister')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(@Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    await this.deviceService.unregisterDevice(token);
  }

  @Post('test-notification')
  async testNotification(
    @Req() req: Request,
    @Body('title') title?: string,
    @Body('body') body?: string,
  ) {
    const userId = (req.user as any)?.userId as string | undefined;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.deviceService.testPushNotification(userId, title, body);
  }

  @Get('push-notification-status')
  async getPushNotificationStatus(@Req() req: Request) {
    const userId = (req.user as any)?.userId as string | undefined;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.deviceService.getPushNotificationStatus(userId);
  }

  @Patch('push-notification-toggle')
  async togglePushNotification(
    @Req() req: Request,
    @Body('enabled') enabled: boolean,
  ) {
    const userId = (req.user as any)?.userId as string | undefined;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    if (typeof enabled !== 'boolean') {
      throw new BadRequestException('enabled must be a boolean');
    }

    return this.deviceService.togglePushNotification(userId, enabled);
  }
}


