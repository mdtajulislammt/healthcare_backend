import {
    Injectable,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateStaffReviewDto } from './dto/create-staff-review.dto';

@Injectable()
export class StaffReviewService {
    constructor(private readonly prisma: PrismaService) { }

    async createReview(user_id: string, staffId: string, dto: CreateStaffReviewDto) {
        try {
            const serviceProvider = await this.prisma.serviceProviderInfo.findFirst({
                where: { user_id },
                select: { id: true },
            });

            if (!serviceProvider) {
                throw new ForbiddenException('Service provider profile not found.');
            }

            const shift = await this.prisma.shift.findUnique({
                where: { id: dto.shift_id },
                select: {
                    id: true,
                    service_provider_id: true,
                    assigned_staff_id: true,
                },
            });

            if (!shift) {
                throw new NotFoundException('Shift not found.');
            }

            if (shift.service_provider_id !== serviceProvider.id) {
                throw new ForbiddenException('You do not have permission to review this shift.');
            }

            if (shift.assigned_staff_id !== staffId) {
                throw new BadRequestException('This staff member was not assigned to the specified shift.');
            }

            const adminAlert = dto.rating < 3;

            const review = await this.prisma.staffPerformanceReview.upsert({
                where: {
                    shift_id_staff_id: {
                        shift_id: dto.shift_id,
                        staff_id: staffId,
                    },
                },
                create: {
                    shift_id: dto.shift_id,
                    staff_id: staffId,
                    provider_id: serviceProvider.id,
                    rating: dto.rating,
                    feedback: dto.feedback ?? null,
                    admin_alert: adminAlert,
                },
                update: {
                    rating: dto.rating,
                    feedback: dto.feedback ?? null,
                    admin_alert: adminAlert,
                    created_at: new Date(),
                },
                include: {
                    staff: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                    shift: {
                        select: {
                            id: true,
                            posting_title: true,
                        },
                    },
                },
            });

            return {
                success: true,
                message: 'Staff performance review saved successfully.',
                data: review,
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof ForbiddenException ||
                error instanceof NotFoundException
            ) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to save staff review.');
        }
    }
}


