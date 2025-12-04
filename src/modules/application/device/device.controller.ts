import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
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
}


