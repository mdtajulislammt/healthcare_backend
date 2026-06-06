import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StaffPreferenceType } from '@prisma/client';
import { ServiceProviderContextHelper } from 'src/common/helper/service-provider-context.helper';

@Injectable()
export class StaffPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerContextHelper: ServiceProviderContextHelper,
  ) {}

  async setPreference(
    user_id: string,
    staffId: string,
    preferenceType: StaffPreferenceType,
    reason?: string,
  ) {
    try {
      const { serviceProviderId } =
        await this.providerContextHelper.resolveFromUser(user_id);

      const staff = await this.prisma.staffProfile.findUnique({
        where: { id: staffId },
        select: { id: true, first_name: true, last_name: true },
      });

      if (!staff) {
        throw new NotFoundException('Staff profile not found.');
      }

      const oppositePreferenceType =
        preferenceType === StaffPreferenceType.favorite
          ? StaffPreferenceType.blocked
          : StaffPreferenceType.favorite;

      const result = await this.prisma.$transaction(async (tx) => {
        // Check if this exact preference already exists
        const existing = await tx.providerStaffPreference.findUnique({
          where: {
            provider_id_staff_id_preference_type: {
              provider_id: serviceProviderId,
              staff_id: staffId,
              preference_type: preferenceType,
            },
          },
        });

        // --- TOGGLE OFF: already exists → delete it ---
        if (existing) {
          await tx.providerStaffPreference.delete({
            where: {
              provider_id_staff_id_preference_type: {
                provider_id: serviceProviderId,
                staff_id: staffId,
                preference_type: preferenceType,
              },
            },
          });

          return { toggled: false, preference: null };
        }

        // --- TOGGLE ON: doesn't exist → delete opposite, then create ---
        await tx.providerStaffPreference.deleteMany({
          where: {
            provider_id: serviceProviderId,
            staff_id: staffId,
            preference_type: oppositePreferenceType,
          },
        });

        const preference = await tx.providerStaffPreference.create({
          data: {
            provider_id: serviceProviderId,
            staff_id: staffId,
            preference_type: preferenceType,
            reason: reason?.trim() || null,
          },
          include: {
            staff: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        });

        return { toggled: true, preference };
      });

      // --- Response based on toggle state ---
      const staffName = `${staff.first_name} ${staff.last_name}`;

      if (!result.toggled) {
        return {
          success: true,
          is_favorite: false,
          is_blocked: false,
          message:
            preferenceType === StaffPreferenceType.favorite
              ? `${staffName} removed from favorites`
              : `${staffName} has been unblocked`,
          data: null,
        };
      }

      return {
        success: true,
        is_favorite: preferenceType === StaffPreferenceType.favorite,
        is_blocked: preferenceType === StaffPreferenceType.blocked,
        message:
          preferenceType === StaffPreferenceType.favorite
            ? `${staffName} added to favorites`
            : `${staffName} has been blocked`,
        data: result.preference,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update staff preference.',
      );
    }
  }

  async getPreferences(user_id: string, preferenceType: StaffPreferenceType) {
    try {
      const { serviceProviderId } =
        await this.providerContextHelper.resolveFromUser(user_id);

      const preferences = await this.prisma.providerStaffPreference.findMany({
        where: {
          provider_id: serviceProviderId,
          preference_type: preferenceType,
        },
        orderBy: { created_at: 'desc' },
        include: {
          staff: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              photo_url: true,
              roles: true,
              reviews: {
                select: { rating: true },
              },
            },
          },
          set_by_employee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      // Calculate average rating for each staff
      const formattedPreferences = preferences.map((pref) => {
        const avgRating = pref.staff.reviews?.length
          ? pref.staff.reviews.reduce((sum, r) => sum + r.rating, 0) /
            pref.staff.reviews.length
          : null;

        return {
          ...pref,
          staff: {
            id: pref.staff.id,
            first_name: pref.staff.first_name,
            last_name: pref.staff.last_name,
            photo_url: pref.staff.photo_url,
            roles: pref.staff.roles,
            avg_rating: avgRating ? Number(avgRating.toFixed(1)) : null,
          },
        };
      });

      return {
        success: true,
        message:
          preferenceType === 'favorite'
            ? 'Favorite staff fetched successfully'
            : 'Blocked staff fetched successfully',
        data: formattedPreferences,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch staff preferences.',
      );
    }
  }
}
