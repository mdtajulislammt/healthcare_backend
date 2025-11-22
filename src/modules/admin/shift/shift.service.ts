import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, ShiftStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

interface FindAllOptions {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
}

@Injectable()
export class ShiftService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(options: FindAllOptions) {
        try {
            const currentPage = Math.max(Number(options.page) || 1, 1);
            const pageSize = Math.min(Math.max(Number(options.limit) || 10, 1), 100);
            if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
                throw new BadRequestException('Invalid pagination parameters');
            }
            const skip = (currentPage - 1) * pageSize;

            const where: Prisma.ShiftWhereInput = {};

            if (options.status) {
                const normalizedStatus = options.status.trim().toLowerCase();
                const matchedStatus = Object.values(ShiftStatus).find(
                    (value) => value.toLowerCase() === normalizedStatus,
                );
                if (matchedStatus) {
                    where.status = matchedStatus;
                }
            }

            if (options.search && options.search.trim()) {
                const term = options.search.trim();
                where.OR = [
                    { posting_title: { contains: term, mode: 'insensitive' } },
                    { facility_name: { contains: term, mode: 'insensitive' } },
                    {
                        service_provider_info: {
                            organization_name: { contains: term, mode: 'insensitive' },
                        },
                    },
                ];
            }

            const [itemsRaw, total] = await this.prisma.$transaction([
                this.prisma.shift.findMany({
                    where,
                    select: {
                        id: true,
                        posting_title: true,
                        shift_type: true,
                        profession_role: true,
                        is_urgent: true,
                        start_date: true,
                        end_date: true,
                        start_time: true,
                        end_time: true,
                        pay_rate_hourly: true,
                        status: true,
                        created_at: true,
                        service_provider_info: {
                            select: {
                                id: true,
                                organization_name: true,
                            },
                        },
                        assigned_staff: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
                            },
                        },
                        _count: {
                            select: {
                                applications: true,
                            },
                        },
                    },
                    skip,
                    take: pageSize,
                    orderBy: {
                        created_at: 'desc',
                    },
                }),
                this.prisma.shift.count({ where }),
            ]);

            const items = itemsRaw.map((s) => ({
                ...s,
                applications_count: s._count?.applications ?? 0,
                _count: undefined,
            }));

            return {
                success: true,
                message: 'Shifts fetched successfully',
                data: items,
                meta: {
                    total,
                    page: currentPage,
                    limit: pageSize,
                    totalPages: Math.ceil(total / pageSize) || 1,
                },
            };
        } catch (error) {
            throw new BadRequestException(error.message || 'Failed to fetch shifts');
        }
    }
}
