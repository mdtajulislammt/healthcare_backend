import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { CertificateVerificationStatus } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) { }


  async findAll({ page = 1, limit = 10, search = '' }: { page?: number; limit?: number; search?: string } = {}) {
    try {
      const currentPage = Math.max(Number(page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
      if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
        throw new BadRequestException('Invalid pagination parameters');
      }
      const skip = (currentPage - 1) * pageSize;

      const where = search
        ? {
          OR: [
            { first_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
            { last_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
            { user: { email: { contains: search, mode: 'insensitive' as Prisma.QueryMode } } },
          ],
        }
        : undefined;

      const [total, staff] = await this.prisma.$transaction([
        this.prisma.staffProfile.count({ where }),
        this.prisma.staffProfile.findMany({
          where,
          select: {
            id: true,
            user_id: true,
            first_name: true,
            last_name: true,
            mobile_code: true,
            mobile_number: true,
            date_of_birth: true,
            photo_url: true,
            cv_url: true,
            roles: true,
            right_to_work_status: true,
            created_at: true,
            updated_at: true,
            user: {
              select: {
                id: true,
                email: true,
                status: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      for (const s of staff) {
        if (s.photo_url) {
          s.photo_url = SojebStorage.url(
            appConfig().storageUrl.staff + s.photo_url,
          );
        }
        if (s.cv_url) {
          s.cv_url = SojebStorage.url(
            appConfig().storageUrl.cv + s.cv_url,
          );
        }
      }

      return {
        success: true,
        message: 'Staff list fetched successfully',
        data: staff,
        meta: {
          total,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to fetch staff list');
    }
  }

  async findOne(id: string) {
    try {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              status: true,
              approved_at: true,
              email_verified_at: true,
              created_at: true,
              updated_at: true,
            },
          },
          certificates: {
            select: {
              id: true,
              certificate_type: true,
              file_url: true,
              uploaded_at: true,
              verified_status: true,
              expiry_date: true,
              expiry_notified_at: true,
            },
            orderBy: { uploaded_at: 'desc' },
          },
          dbs_info: true,
        },
      });

      if (!staff) throw new NotFoundException('Staff not found');

      if (staff.photo_url) {
        staff.photo_url = SojebStorage.url(
          appConfig().storageUrl.staff + staff.photo_url,
        );
      }
      if (staff.cv_url) {
        staff.cv_url = SojebStorage.url(
          appConfig().storageUrl.cv + staff.cv_url,
        );
      }
      if (staff.certificates && staff.certificates.length) {
        for (const c of staff.certificates) {
          if (c.file_url) {
            c.file_url = SojebStorage.url(
              appConfig().storageUrl.certificate + c.file_url,
            );
          }
        }
      }

      return { success: true, message: 'Staff fetched successfully', data: staff };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch staff');
    }
  }

  update(id: string, updateStaffDto: UpdateStaffDto) {
    return `This action updates a #${id} staff`;
  }

  remove(id: string) {
    return `This action removes a #${id} staff`;
  }

  async updateStatus(id: string, status: number) {
    try {
      const allowed = new Set([0, 1, 2]);
      if (!allowed.has(Number(status))) {
        throw new BadRequestException('Invalid status. Allowed: 0=pending, 1=active, 2=suspended');
      }

      const staff = await this.prisma.staffProfile.findUnique({
        where: { id },
        select: { id: true, user_id: true },
      });
      if (!staff) throw new NotFoundException('Staff not found');

      // Prepare update data
      const updateData: any = { status: Number(status) };

      // If status is 1 (active), set approved_at to current date
      // If status is not 1, remove approved_at (set to null)
      if (Number(status) === 1) {
        updateData.approved_at = new Date();
      } else {
        updateData.approved_at = null;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: staff.user_id },
        data: updateData,
        select: { id: true, email: true, status: true, approved_at: true, updated_at: true },
      });

      return { success: true, message: 'Staff status updated successfully', data: updatedUser };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update staff status');
    }
  }

  async updateCertificateStatus(certificateId: string, verified_status: 'pending' | 'verified' | 'rejected') {
    try {
      const allowed = new Set<CertificateVerificationStatus>([
        'pending',
        'verified',
        'rejected',
      ]);
      if (!allowed.has(verified_status as CertificateVerificationStatus)) {
        throw new BadRequestException(
          'Invalid verified_status. Allowed: pending, verified, rejected',
        );
      }

      const cert = await this.prisma.staffCertificate.findUnique({
        where: { id: certificateId },
        select: { id: true },
      });
      if (!cert) throw new NotFoundException('Certificate not found');

      const updated = await this.prisma.staffCertificate.update({
        where: { id: certificateId },
        data: { verified_status: verified_status as CertificateVerificationStatus },
        select: {
          id: true,
          certificate_type: true,
          verified_status: true,
          uploaded_at: true,
          expiry_date: true,
        },
      });

      return { success: true, message: 'Certificate status updated', data: updated };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update certificate status');
    }
  }

  async getStats() {
    try {
      const [total, pending, active, suspended] = await this.prisma.$transaction([
        this.prisma.staffProfile.count(),
        this.prisma.staffProfile.count({ where: { user: { status: 0 } } }),
        this.prisma.staffProfile.count({ where: { user: { status: 1 } } }),
        this.prisma.staffProfile.count({ where: { user: { status: 2 } } }),
      ]);

      return {
        success: true,
        message: 'Staff statistics fetched successfully',
        data: { total, pending, active, suspended },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch staff statistics');
    }
  }
}
