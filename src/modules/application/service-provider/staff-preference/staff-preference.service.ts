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
    ) { }

    async setPreference(
        user_id: string,
        staffId: string,
        preferenceType: StaffPreferenceType,
        reason?: string,
    ) {
        try {
            const { serviceProviderId } = await this.providerContextHelper.resolveFromUser(user_id);

            const staff = await this.prisma.staffProfile.findUnique({
                where: { id: staffId },
                select: { id: true, first_name: true, last_name: true },
            });

            if (!staff) {
                throw new NotFoundException('Staff profile not found.');
            }

            // Determine the opposite preference type
            const oppositePreferenceType = preferenceType === StaffPreferenceType.favorite 
                ? StaffPreferenceType.blocked 
                : StaffPreferenceType.favorite;

            // Use transaction to ensure atomicity
            const preference = await this.prisma.$transaction(async (tx) => {
                // Delete opposite preference if exists
                await tx.providerStaffPreference.deleteMany({
                    where: {
                        provider_id: serviceProviderId,
                        staff_id: staffId,
                        preference_type: oppositePreferenceType,
                    },
                });

                // Upsert the new preference
                return tx.providerStaffPreference.upsert({
                    where: {
                        provider_id_staff_id_preference_type: {
                            provider_id: serviceProviderId,
                            staff_id: staffId,
                            preference_type: preferenceType,
                        },
                    },
                    create: {
                        provider_id: serviceProviderId,
                        staff_id: staffId,
                        preference_type: preferenceType,
                        reason: reason?.trim() || null,
                    },
                    update: {
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
            });

            return {
                success: true,
                message:
                    preferenceType === 'favorite'
                        ? 'Staff added to favorites successfully'
                        : 'Staff blocked successfully',
                data: preference,
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof ForbiddenException ||
                error instanceof NotFoundException
            ) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to update staff preference.');
        }
    }

    async getPreferences(user_id: string, preferenceType: StaffPreferenceType) {
        try {
            const { serviceProviderId } = await this.providerContextHelper.resolveFromUser(user_id);

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
                                select: { rating: true }
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
            const formattedPreferences = preferences.map(pref => {
                const avgRating = pref.staff.reviews?.length
                    ? pref.staff.reviews.reduce((sum, r) => sum + r.rating, 0) / pref.staff.reviews.length
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
            throw new InternalServerErrorException('Failed to fetch staff preferences.');
        }
    }

}


