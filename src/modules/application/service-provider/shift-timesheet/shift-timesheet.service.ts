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

@Injectable()
export class ShiftTimesheetService {
  constructor(private readonly prisma: PrismaService) { }

  create(createShiftTimesheetDto: CreateShiftTimesheetDto) {
    return 'This action adds a new shiftTimesheet';
  }

  findAll() {
    return `This action returns all shiftTimesheet`;
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

  private async handleTimesheetDecision(
    timesheetId: string,
    user_id: string,
    status: TimesheetStatus,
    message?: string,
  ) {
    try {
      const serviceProvider = await this.prisma.serviceProviderInfo.findFirst({
        where: { user_id },
        select: { id: true },
      });

      if (!serviceProvider) {
        throw new ForbiddenException('Service provider profile not found.');
      }

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

      if (timesheet.shift.service_provider_id !== serviceProvider.id) {
        throw new ForbiddenException('You do not have permission to update this timesheet.');
      }

      if (timesheet.status === status) {
        throw new BadRequestException(`Timesheet is already ${status}.`);
      }

      const updatedTimesheet = await this.prisma.shiftTimesheet.update({
        where: { id: timesheetId },
        data: {
          status,
          notes: message ?? timesheet.notes,
          reviewed_at: new Date(),
          approved_by: serviceProvider.id,
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
