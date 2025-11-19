import {
    Injectable,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StaffPreferenceType } from '@prisma/client';

@Injectable()
export class StaffPreferenceService {
    constructor(private readonly prisma: PrismaService) { }

    async setPreference(
        user_id: string,
        staffId: string,
        preferenceType: StaffPreferenceType,
        reason?: string,
    ) {
        try {
            const serviceProvider = await this.prisma.serviceProviderInfo.findFirst({
                where: { user_id },
                select: { id: true },
            });

            if (!serviceProvider) {
                throw new ForbiddenException('Service provider profile not found.');
            }

            const staff = await this.prisma.staffProfile.findUnique({
                where: { id: staffId },
                select: { id: true, first_name: true, last_name: true },
            });

            if (!staff) {
                throw new NotFoundException('Staff profile not found.');
            }

            const preference = await this.prisma.providerStaffPreference.upsert({
                where: {
                    provider_id_staff_id_preference_type: {
                        provider_id: serviceProvider.id,
                        staff_id: staffId,
                        preference_type: preferenceType,
                    },
                },
                create: {
                    provider_id: serviceProvider.id,
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
            const serviceProvider = await this.prisma.serviceProviderInfo.findFirst({
                where: { user_id },
                select: { id: true },
            });

            if (!serviceProvider) {
                throw new ForbiddenException('Service provider profile not found.');
            }

            const preferences = await this.prisma.providerStaffPreference.findMany({
                where: {
                    provider_id: serviceProvider.id,
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

            return {
                success: true,
                message:
                    preferenceType === 'favorite'
                        ? 'Favorite staff fetched successfully'
                        : 'Blocked staff fetched successfully',
                data: preferences,
            };
        } catch (error) {
            if (error instanceof ForbiddenException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to fetch staff preferences.');
        }
    }
}


