import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

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
}


