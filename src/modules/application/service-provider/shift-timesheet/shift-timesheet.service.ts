import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { TimesheetStatus } from '@prisma/client';
import { CreateShiftTimesheetDto } from './dto/create-shift-timesheet.dto';
import { UpdateShiftTimesheetDto } from './dto/update-shift-timesheet.dto';
import { ApproveTimesheetDto } from './dto/approve-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ServiceProviderContextHelper } from 'src/common/helper/service-provider-context.helper';
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';

@Injectable()
export class ShiftTimesheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerContextHelper: ServiceProviderContextHelper,
  ) { }

  create(createShiftTimesheetDto: CreateShiftTimesheetDto) {
    return 'This action adds a new shiftTimesheet';
  }

  async findAll(user_id: string, options?: { page?: number; limit?: number; status?: string }) {
    try {
      const { serviceProviderId } = await this.providerContextHelper.resolveFromUser(user_id);

      const currentPage = Math.max(Number(options?.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(options?.limit) || 10, 1), 100);
      const skip = (currentPage - 1) * pageSize;

      const where: any = {
        shift: {
          service_provider_id: serviceProviderId,
        },
        status: options?.status || { in: [TimesheetStatus.submitted, TimesheetStatus.under_review, TimesheetStatus.pending_submission] },
      };

      const [total, timesheets] = await this.prisma.$transaction([
        this.prisma.shiftTimesheet.count({ where }),
        this.prisma.shiftTimesheet.findMany({
          where,
          select: {
            id: true,
            status: true,
            total_hours: true,
            total_pay: true,
            submitted_at: true,
            reviewed_at: true,
            created_at: true,
            shift: {
              select: {
                id: true,
                posting_title: true,
                facility_name: true,
                start_date: true,
                end_date: true,
                attendance: {
                  select: {
                    id: true,
                    status: true,
                    check_in_time: true,
                    check_out_time: true,
                    location_check: true,
                  },
                },
              },
            },
            staff: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                photo_url: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      const formattedTimesheets = timesheets.map((timesheet) => ({
        ...timesheet,
        staff: {
          ...timesheet.staff,
          photo_url: timesheet.staff.photo_url 
            ? SojebStorage.url(appConfig().storageUrl.staff + timesheet.staff.photo_url) 
            : null,
        },
      }));

      return {
        success: true,
        message: 'Timesheets fetched successfully',
        data: formattedTimesheets,
        meta: {
          total,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch timesheets.');
    }
  }

  findOne(id: string) {
    return `This action returns a #${id} shiftTimesheet`;
  }

  update(id: string, updateShiftTimesheetDto: UpdateShiftTimesheetDto) {
    return `This action updates a #${id} shiftTimesheet`;
  }

  remove(id: string) {
    return `This action removes a #${id} shiftTimesheet`;
  }

  async approveTimesheet(id: string, user_id: string, dto: ApproveTimesheetDto) {
    return this.handleTimesheetDecision(id, user_id, TimesheetStatus.approved, dto.message);
  }

  async rejectTimesheet(id: string, user_id: string, dto: RejectTimesheetDto) {
    return this.handleTimesheetDecision(id, user_id, TimesheetStatus.rejected, dto.message);
  }

  async findByShiftId(shiftId: string, user_id: string) {
    try {
      const { serviceProviderId } = await this.providerContextHelper.resolveFromUser(user_id);

      const timesheet = await this.prisma.shiftTimesheet.findFirst({
        where: {
          shift_id: shiftId,
          shift: {
            service_provider_id: serviceProviderId,
          },
        },
        include: {
          shift: {
            select: {
              id: true,
              posting_title: true,
              facility_name: true,
              start_date: true,
              end_date: true,
              start_time: true,
              end_time: true,
              status: true,
              attendance: {
                select: {
                  id: true,
                  status: true,
                  check_in_time: true,
                  check_out_time: true,
                  location_check: true,
                  created_at: true,
                  updated_at: true,
                },
              },
            },
          },
          staff: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              photo_url: true,
            },
          },
        },
      });

      if (!timesheet) {
        throw new NotFoundException('Timesheet not found for this shift');
      }

      return {
        success: true,
        message: 'Timesheet fetched successfully',
        data: timesheet,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch timesheet for shift');
    }
  }

  private async handleTimesheetDecision(
    timesheetId: string,
    user_id: string,
    status: TimesheetStatus,
    message?: string,
  ) {
    try {
      const { serviceProviderId } = await this.providerContextHelper.resolveFromUser(user_id);

      const timesheet = await this.prisma.shiftTimesheet.findUnique({
        where: { id: timesheetId },
        include: {
          shift: { select: { id: true, service_provider_id: true, posting_title: true } },
          staff: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!timesheet) {
        throw new NotFoundException('Timesheet not found');
      }

      if (timesheet.shift.service_provider_id !== serviceProviderId) {
        throw new ForbiddenException('You do not have permission to update this timesheet.');
      }

      if (timesheet.status === status) {
        throw new BadRequestException(`Timesheet is already ${status}.`);
      }

      // Update timesheet and shift status in a transaction
      const updatedTimesheet = await this.prisma.$transaction(async (tx) => {
        // Update timesheet
        const updated = await tx.shiftTimesheet.update({
          where: { id: timesheetId },
          data: {
            status,
            notes: message ?? timesheet.notes,
            reviewed_at: new Date(),
            approved_by: serviceProviderId,
          },
          include: {
            shift: { select: { id: true, posting_title: true } },
            staff: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        });

        // Update shift status based on timesheet status
        let shiftStatus: string | undefined;
        if (status === TimesheetStatus.approved) {
          shiftStatus = 'completed';
        } else if (status === TimesheetStatus.rejected) {
          shiftStatus = 'assigned';
        }

        if (shiftStatus) {
          await tx.shift.update({
            where: { id: timesheet.shift.id },
            data: { status: shiftStatus as any },
          });
        }

        return updated;
      });

      return {
        success: true,
        message:
          status === TimesheetStatus.approved
            ? 'Timesheet approved successfully'
            : 'Timesheet rejected successfully',
        data: updatedTimesheet,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update timesheet status.');
    }
  }


}
