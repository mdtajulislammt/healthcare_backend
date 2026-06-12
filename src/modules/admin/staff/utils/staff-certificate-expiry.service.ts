import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MailService } from '../../../../mail/mail.service';
import { NotificationRepository } from '../../../../common/repository/notification/notification.repository';

@Injectable()
export class StaffCertificateExpiryService {
  private readonly logger = new Logger(StaffCertificateExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @Cron('0 0 * * 0', { name: 'staffCertificateExpiryWeekly' })
  async handleWeeklyExpiryCheck() {
    this.logger.log('Running weekly staff certificate expiry check');
    await this.checkExpiredCertificates();
  }

  async checkExpiredCertificates() {
    const now = new Date();
    const expired = await this.prisma.staffCertificate.findMany({
      where: {
        expiry_date: { lte: now },
        expiry_notified_at: null,
      },
      include: {
        staff: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!expired || expired.length === 0) {
      this.logger.log('No expired certificates found');
      return;
    }

    const expiredList = expired.map((c) => ({
      id: c.id,
      type: c.certificate_type,
      expiry_date: c.expiry_date
        ? c.expiry_date.toISOString().split('T')[0]
        : undefined,
      staffId: c.staff_id,
      staffName: c.staff
        ? `${c.staff.first_name} ${c.staff.last_name}`
        : undefined,
      staffEmail: c.staff?.user?.email,
      staffUserId: c.staff?.user?.id,
    }));

    const admins = await this.prisma.user.findMany({
      where: { type: 'admin' },
      select: { id: true, email: true },
    });

    for (const admin of admins) {
      const text = `Expired certificates detected: ${expiredList.length} items`;
      await NotificationRepository.createNotification({
        receiver_id: admin.id,
        text,
        type: 'booking',
      });

      if (admin.email) {
        try {
          await this.mailService.sendCertificateExpiryEmail({
            to: admin.email,
            name: admin.email,
            expiredCertificates: expiredList.map((e) => ({
              type: e.type,
              expiry_date: e.expiry_date,
              staffName: e.staffName,
            })),
          });
        } catch (err) {
          this.logger.error(
            `Failed to queue expiry email for admin ${admin.email}`,
            err,
          );
        }
      }
    }

    const staffNotifications = new Map<
      string,
      {
        userId: string;
        email?: string;
        staffName: string;
        certificates: { type: string; expiry_date?: string }[];
      }
    >();

    for (const cert of expiredList) {
      if (!cert.staffUserId) continue;

      const existing = staffNotifications.get(cert.staffUserId);
      const entry = {
        type: cert.type,
        expiry_date: cert.expiry_date,
      };

      if (existing) {
        existing.certificates.push(entry);
      } else {
        staffNotifications.set(cert.staffUserId, {
          userId: cert.staffUserId,
          email: cert.staffEmail,
          staffName: cert.staffName ?? 'Staff member',
          certificates: [entry],
        });
      }
    }

    for (const staffInfo of staffNotifications.values()) {
      await NotificationRepository.createNotification({
        receiver_id: staffInfo.userId,
        text: 'Your certificate(s) have expired and need to be updated.',
        type: 'booking',
      });

      if (staffInfo.email) {
        try {
          await this.mailService.sendCertificateExpiryEmail({
            to: staffInfo.email,
            name: staffInfo.staffName,
            expiredCertificates: staffInfo.certificates,
          });
        } catch (err) {
          this.logger.error(
            `Failed to queue expiry email for staff ${staffInfo.email}`,
            err,
          );
        }
      }
    }

    const ids = expired.map((e) => e.id);
    await this.prisma.staffCertificate.updateMany({
      where: { id: { in: ids } },
      data: { expiry_notified_at: new Date() },
    });

    this.logger.log(
      `Notified ${admins.length} admins and ${staffNotifications.size} staff users about ${expired.length} expired certificates`,
    );
  }
}
