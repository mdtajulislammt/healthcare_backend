import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, StaffPerformanceReview, ReviewStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';

@Injectable()
export class StaffReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    search = '',
    ratingBelow,
    staffId,
    providerId,
    shiftId,
    status,
    sortRating,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    ratingBelow?: number;
    staffId?: string;
    providerId?: string;
    shiftId?: string;
    status?: string;
    sortRating?: 'asc' | 'desc';
  } = {}) {
    try {
      const currentPage = Math.max(Number(page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);

      if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
        throw new BadRequestException('Invalid pagination parameters');
      }

      const skip = (currentPage - 1) * pageSize;
      const trimmedSearch = search?.trim();

      let ratingCondition: Prisma.StaffPerformanceReviewWhereInput = {};
      if (ratingBelow !== undefined) {
        if (Number.isNaN(Number(ratingBelow))) {
          throw new BadRequestException('Invalid ratingBelow value');
        }

        ratingCondition = { rating: { lt: Number(ratingBelow) } };
      }

      const where: Prisma.StaffPerformanceReviewWhereInput = {
        ...(staffId ? { staff_id: staffId } : {}),
        ...(providerId ? { provider_id: providerId } : {}),
        ...(shiftId ? { shift_id: shiftId } : {}),
        ...(status ? { status: status as ReviewStatus } : {}),
        ...ratingCondition,
        ...(trimmedSearch
          ? {
              OR: [
                {
                  feedback: {
                    contains: trimmedSearch,
                    mode: 'insensitive' as Prisma.QueryMode,
                  },
                },
                {
                  staff: {
                    is: {
                      OR: [
                        {
                          first_name: {
                            contains: trimmedSearch,
                            mode: 'insensitive' as Prisma.QueryMode,
                          },
                        },
                        {
                          last_name: {
                            contains: trimmedSearch,
                            mode: 'insensitive' as Prisma.QueryMode,
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  shift: {
                    is: {
                      posting_title: {
                        contains: trimmedSearch,
                        mode: 'insensitive' as Prisma.QueryMode,
                      },
                    },
                  },
                },
                {
                  provider: {
                    is: {
                      organization_name: {
                        contains: trimmedSearch,
                        mode: 'insensitive' as Prisma.QueryMode,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };

      const [total, items, allRatings] = await this.prisma.$transaction([
        this.prisma.staffPerformanceReview.count({ where }),
        this.prisma.staffPerformanceReview.findMany({
          where,
          select: {
            id: true,
            provider_id: true,
            staff_id: true,
            shift_id: true,
            rating: true,
            feedback: true,
            status: true,
            admin_alert: true,
            created_by: true,
            created_at: true,
            staff: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                photo_url: true,
                mobile_code: true,
                mobile_number: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
            shift: {
              select: {
                id: true,
                posting_title: true,
                shift_type: true,
                profession_role: true,
                start_date: true,
                end_date: true,
                status: true,
                facility_name: true,
              },
            },
            provider: {
              select: {
                id: true,
                organization_name: true,
                primary_address: true,
                brand_logo_url:true
              },
            },
          },
          orderBy: sortRating ? { rating: sortRating } : { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
        // Fetch all ratings (without pagination) to calculate breakdown
        this.prisma.staffPerformanceReview.findMany({
          where,
          select: { rating: true },
        }),
      ]);

      // build rating breakdown 1-5 from all matching reviews
      const ratingBreakdown = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };
      for (const review of allRatings) {
        if (review.rating >= 1 && review.rating <= 5) {
          ratingBreakdown[review.rating]++;
        }
      }

      const data = items.map((review: StaffPerformanceReview & any) => ({
        ...review,
        staff: review.staff
          ? {
              ...review.staff,
              photo_url: review.staff.photo_url
                ? SojebStorage.url(
                    appConfig().storageUrl.staff + review.staff.photo_url,
                  )
                : null,
            }
          : null,
        provider: review.provider
          ? {
              ...review.provider,
              brand_logo_url: review.provider.brand_logo_url
                ? SojebStorage.url(
                    appConfig().storageUrl.brand + review.provider.brand_logo_url,
                  )
                : null,
            }
          : null,
      }));

      return {
        success: true,
        message: 'Staff reviews fetched successfully',
        data,
        meta: {
          total,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
          ratingBreakdown,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch staff reviews');
    }
  }

  async remove(id: string) {
    try {
      if (!id || !id.trim()) {
        throw new BadRequestException('Review ID is required');
      }

      const review = await this.prisma.staffPerformanceReview.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!review) {
        throw new BadRequestException('Staff review not found');
      }

      await this.prisma.staffPerformanceReview.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Staff review deleted successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete staff review');
    }
  }

  async findOne(id: string) {
    try {
      if (!id || !id.trim()) {
        throw new BadRequestException('Review ID is required');
      }

      const review = await this.prisma.staffPerformanceReview.findUnique({
        where: { id },
        select: {
          id: true,
          provider_id: true,
          staff_id: true,
          shift_id: true,
          rating: true,
          feedback: true,
          status: true,
          admin_alert: true,
          created_by: true,
          created_at: true,
          staff: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              photo_url: true,
              mobile_code: true,
              mobile_number: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          shift: {
            select: {
              id: true,
              posting_title: true,
              shift_type: true,
              profession_role: true,
              start_date: true,
              end_date: true,
              status: true,
              facility_name: true,
            },
          },
          provider: {
            select: {
              id: true,
              organization_name: true,
              primary_address: true,
              brand_logo_url: true,
            },
          },
        },
      });

      if (!review) {
        throw new BadRequestException('Staff review not found');
      }

      return {
        success: true,
        message: 'Staff review fetched successfully',
        data: {
          ...review,
          staff: review.staff
            ? {
                ...review.staff,
                photo_url: review.staff.photo_url
                  ? SojebStorage.url(
                      appConfig().storageUrl.staff + review.staff.photo_url,
                    )
                  : null,
              }
            : null,
          provider: review.provider
            ? {
                ...review.provider,
                brand_logo_url: review.provider.brand_logo_url
                  ? SojebStorage.url(
                      appConfig().storageUrl.brand + review.provider.brand_logo_url,
                    )
                  : null,
              }
            : null,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch staff review');
    }
  }

  async updateStatus(id: string, status: ReviewStatus) {
    try {
      if (!id || !id.trim()) {
        throw new BadRequestException('Review ID is required');
      }

      const review = await this.prisma.staffPerformanceReview.findUnique({
        where: { id },
        select: { id: true, status: true, rating: true, staff_id: true },
      });

      if (!review) {
        throw new BadRequestException('Staff review not found');
      }

      const updated = await this.prisma.staffPerformanceReview.update({
        where: { id },
        data: { status },
      });

      if (status === 'approved' && updated.rating < 3) {
        const staffProfile = await this.prisma.staffProfile.findUnique({
          where: { id: review.staff_id },
          select: {
            id: true,
            first_name: true,
            last_name: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        });

        await this.prisma.$transaction([
          this.prisma.staffProfile.update({
            where: { id: review.staff_id },
            data: { can_apply_to_shifts: false },
          }),
          this.prisma.shift.updateMany({
            where: {
              assigned_staff_id: review.staff_id,
              status: 'assigned',
              start_date: { gte: new Date() },
            },
            data: {
              assigned_staff_id: null,
              status: 'published',
            },
          }),
          this.prisma.shiftApplication.updateMany({
            where: {
              staff_id: review.staff_id,
              status: 'accepted',
              shift: {
                is: {
                  start_date: { gte: new Date() },
                },
              },
            },
            data: { status: 'cancelled' },
          }),
        ]);

        if (staffProfile?.user?.email) {
          await this.mailService.sendStaffSuspensionEmail({
            email: staffProfile.user.email,
            name: `${staffProfile.first_name} ${staffProfile.last_name}`,
            rating: updated.rating,
          });
        }
      }

      return {
        success: true,
        message: 'Staff review status updated successfully',
        data: updated,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update review status');
    }
  }
}
