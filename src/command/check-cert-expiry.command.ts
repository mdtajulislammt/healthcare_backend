import { Command, CommandRunner } from 'nest-commander';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationRepository } from '../common/repository/notification/notification.repository';
import appConfig from '../config/app.config';

@Command({
  name: 'check-cert-expiry',
  description: 'Check for expired staff certificates and notify admins',
})
export class CheckCertExpiryCommand extends CommandRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async run(passedParam: string[]) {
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
      console.log('No expired certificates found');
      return;
    }

    // prepare aggregated list
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
    }));

    // notify admins via DB notification and email
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

      try {
        await this.mailService.sendCertificateExpiryEmail({
          to: admin.email,
          name: admin.email || 'Admin',
          expiredCertificates: expiredList.map((e) => ({
            type: e.type,
            expiry_date: e.expiry_date,
            staffName: e.staffName,
          })),
        });
      } catch (err) {
        console.error(
          'Failed to queue expiry email for admin',
          admin.email,
          err,
        );
      }
    }

    // notify affected staff members
    const staffNotifications = new Map<
      string,
      {
        userId: string;
        email?: string;
        staffName: string;
        certificates: { type: string; expiry_date?: string }[];
      }
    >();

    for (const cert of expired) {
      if (!cert.staff || !cert.staff.user?.id) {
        continue;
      }

      const userId = cert.staff.user.id;
      const email = cert.staff.user.email;
      const staffName = `${cert.staff.first_name} ${cert.staff.last_name}`;
      const existing = staffNotifications.get(userId);
      const certificateEntry = {
        type: cert.certificate_type,
        expiry_date: cert.expiry_date
          ? cert.expiry_date.toISOString().split('T')[0]
          : undefined,
      };

      if (existing) {
        existing.certificates.push(certificateEntry);
      } else {
        staffNotifications.set(userId, {
          userId,
          email,
          staffName,
          certificates: [certificateEntry],
        });
      }
    }

    for (const staffInfo of staffNotifications.values()) {
      const text = `Your certificate(s) have expired and require update.`;
      await NotificationRepository.createNotification({
        receiver_id: staffInfo.userId,
        text,
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
          console.error(
            'Failed to queue expiry email for staff',
            staffInfo.email,
            err,
          );
        }
      }
    }

    // mark certificates as notified
    const ids = expired.map((e) => e.id);
    await this.prisma.staffCertificate.updateMany({
      where: { id: { in: ids } },
      data: { expiry_notified_at: new Date() },
    });

    console.log(
      `Notified ${admins.length} admins and ${staffNotifications.size} staff users about ${expired.length} expired certificates`,
    );
  }
}
