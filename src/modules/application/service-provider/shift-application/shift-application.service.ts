import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateShiftApplicationDto } from './dto/create-shift-application.dto';
import { UpdateShiftApplicationDto } from './dto/update-shift-application.dto';
import { AcceptApplicationDto } from './dto/accept-application.dto';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ShiftApplicationStatus, ShiftStatus } from '@prisma/client';

@Injectable()
export class ShiftApplicationService {
  constructor(private readonly prisma: PrismaService) { }

  create(createShiftApplicationDto: CreateShiftApplicationDto) {
    return 'This action adds a new shiftApplication';
  }

  findAll() {
    return `This action returns all shiftApplication`;
  }

  findOne(id: number) {
    return `This action returns a #${id} shiftApplication`;
  }

  update(id: number, updateShiftApplicationDto: UpdateShiftApplicationDto) {
    return `This action updates a #${id} shiftApplication`;
  }

  remove(id: number) {
    return `This action removes a #${id} shiftApplication`;
  }

  /**
   * Accept or reject a shift application
   * @param applicationId - The ID of the application to accept/reject
   * @param user_id - The user ID from JWT token
   * @param acceptApplicationDto - DTO containing action (accepted/rejected) and optional notes
   */
  async acceptApplication(
    applicationId: string,
    user_id: string,
    acceptApplicationDto: AcceptApplicationDto,
  ) {
    try {
      const { action, notes } = acceptApplicationDto;

      // Get service provider from user_id
      const serviceProvider = await this.prisma.serviceProviderInfo.findFirst({
        where: { user_id },
        select: { id: true, user_id: true },
      });

      if (!serviceProvider) {
        throw new ForbiddenException(
          'Service provider profile not found. Only service providers can accept applications.',
        );
      }

      // Get the application with shift details
      const application = await this.prisma.shiftApplication.findUnique({
        where: { id: applicationId },
        include: {
          shift: {
            select: {
              id: true,
              service_provider_id: true,
              status: true,
              assigned_staff_id: true,
              posting_title: true,
            },
          },
          staff: {
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
          },
        },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      // Verify that the shift belongs to the service provider
      if (application.shift.service_provider_id !== serviceProvider.id) {
        throw new ForbiddenException(
          'You do not have permission to accept/reject this application. This shift does not belong to your service provider.',
        );
      }

      // Validate application status
      if (application.status !== 'pending') {
        throw new BadRequestException(
          `Cannot ${action} an application with status: ${application.status}. Only pending applications can be ${action}.`,
        );
      }

      // If accepting, validate shift status
      if (action === 'accepted') {
        // Check if shift is still published (not already assigned, completed, or cancelled)
        if (application.shift.status !== 'published') {
          throw new BadRequestException(
            `Cannot accept application. Shift status is: ${application.shift.status}. Only published shifts can accept applications.`,
          );
        }

        // Check if shift is already assigned to someone else
        if (
          application.shift.assigned_staff_id &&
          application.shift.assigned_staff_id !== application.staff_id
        ) {
          throw new BadRequestException(
            'This shift has already been assigned to another staff member.',
          );
        }

        // Use transaction to ensure atomicity
        const result = await this.prisma.$transaction(async (tx) => {
          // Update the application status to accepted
          const updatedApplication = await tx.shiftApplication.update({
            where: { id: applicationId },
            data: {
              status: 'accepted' as ShiftApplicationStatus,
              reviewed_at: new Date(),
              notes: notes || null,
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
                },
              },
              staff: {
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
              },
            },
          });

          // Assign staff to the shift
          await tx.shift.update({
            where: { id: application.shift.id },
            data: {
              assigned_staff_id: application.staff_id,
              status: 'assigned' as ShiftStatus,
            },
          });

          // Reject all other pending applications for this shift
          await tx.shiftApplication.updateMany({
            where: {
              shift_id: application.shift.id,
              staff_id: { not: application.staff_id },
              status: 'pending',
            },
            data: {
              status: 'rejected' as ShiftApplicationStatus,
              reviewed_at: new Date(),
              notes: 'Application rejected. Shift has been assigned to another applicant.',
            },
          });

          return updatedApplication;
        });

        return {
          success: true,
          message: 'Application accepted successfully. Staff has been assigned to the shift.',
          data: result,
        };
      } else {
        // Reject the application
        const updatedApplication = await this.prisma.shiftApplication.update({
          where: { id: applicationId },
          data: {
            status: 'rejected' as ShiftApplicationStatus,
            reviewed_at: new Date(),
            notes: notes || null,
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
              },
            },
            staff: {
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
            },
          },
        });

        return {
          success: true,
          message: 'Application rejected successfully',
          data: updatedApplication,
        };
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process application');
    }
  }
}
