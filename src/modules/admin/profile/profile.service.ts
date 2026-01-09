import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateAdminProfileDto } from './dto/update-admin-profile.dto';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import appConfig from '../../../config/app.config';
import { StringHelper } from '../../../common/helper/string.helper';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get admin profile
   * @param userId - The user ID of the admin
   */
  async getAdminProfile(userId: string) {
    const adminUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        admin_profile: true,
      },
    });

    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }

    const profile = adminUser.admin_profile;
    if (!profile) {
      throw new NotFoundException('Admin profile not found');
    }

    return {
      success: true,
      message: 'Admin profile fetched successfully',
      data: {
        id: adminUser.id,
        email: adminUser.email,
        type: adminUser.type,
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.photo_url
          ? SojebStorage.url(appConfig().storageUrl.avatar + profile.photo_url)
          : null,
        phone_number: profile.mobile_number
          ? `${profile.mobile_code || ''}${profile.mobile_number}`
          : null,
        mobile_code: profile.mobile_code,
        mobile_number: profile.mobile_number,
        date_of_birth: profile.date_of_birth,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    };
  }

  /**
   * Update admin profile with optional avatar file
   * @param userId - The user ID of the admin
   * @param updateData - The profile data to update
   * @param avatarFile - Optional avatar file
   */
  async updateAdminProfile(
    userId: string,
    updateData: UpdateAdminProfileDto,
    avatarFile?: Express.Multer.File,
  ) {
    const adminUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        admin_profile: true,
      },
    });

    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }

    const existingProfile = adminUser.admin_profile;
    if (!existingProfile) {
      throw new NotFoundException('Admin profile not found');
    }

    const updateProfilePayload: any = {
      updated_at: new Date(),
    };

    // Build profile update payload
    if (updateData.name !== undefined) {
      const parts = updateData.name.trim().split(' ');
      updateProfilePayload.first_name = parts.shift() || existingProfile.first_name;
      updateProfilePayload.last_name = parts.join(' ') || existingProfile.last_name;
    }

    if (updateData.phone_number !== undefined) {
      updateProfilePayload.mobile_number = updateData.phone_number;
    }

    if (updateData.mobile_code !== undefined) {
      updateProfilePayload.mobile_code = updateData.mobile_code;
    }

    if (updateData.date_of_birth !== undefined) {
      updateProfilePayload.date_of_birth = updateData.date_of_birth;
    }

    // Handle avatar file upload if provided
    if (avatarFile) {
      if (existingProfile.photo_url) {
        try {
          await SojebStorage.delete(appConfig().storageUrl.avatar + existingProfile.photo_url);
        } catch (error) {
          console.error('Failed to delete old avatar:', error);
        }
      }

      const avatarFileName = `${StringHelper.randomString()}${avatarFile.originalname}`;
      await SojebStorage.put(
        appConfig().storageUrl.avatar + avatarFileName,
        avatarFile.buffer,
      );
      updateProfilePayload.photo_url = avatarFileName;
    }

    const updatedProfile = await this.prisma.adminProfile.update({
      where: { user_id: userId },
      data: updateProfilePayload,
      select: {
        first_name: true,
        last_name: true,
        photo_url: true,
        mobile_code: true,
        mobile_number: true,
        date_of_birth: true,
        updated_at: true,
      },
    });

    return {
      message: 'Admin profile updated successfully',
      data: {
        id: adminUser.id,
        email: adminUser.email,
        type: adminUser.type,
        name: `${updatedProfile.first_name} ${updatedProfile.last_name}`.trim(),
        avatar_url: updatedProfile.photo_url
          ? SojebStorage.url(appConfig().storageUrl.avatar + updatedProfile.photo_url)
          : null,
        phone_number: updatedProfile.mobile_number
          ? `${updatedProfile.mobile_code || ''}${updatedProfile.mobile_number}`
          : null,
        date_of_birth: updatedProfile.date_of_birth,
        updated_at: updatedProfile.updated_at,
      },
    };
  }
}
