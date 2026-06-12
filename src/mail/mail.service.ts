import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import appConfig from '../config/app.config';

@Injectable()
export class MailService {
  constructor(
    @InjectQueue('mail-queue') private queue: Queue,
    private mailerService: MailerService,
  ) {}

  async sendMemberInvitation({ user, member, url }) {
    try {
      const from = `${process.env.APP_NAME} <${appConfig().mail.from}>`;
      const subject = `${user.fname} is inviting you to ${appConfig().app.name}`;

      // add to queue
      await this.queue.add('sendMemberInvitation', {
        to: member.email,
        from: from,
        subject: subject,
        template: 'member-invitation',
        context: {
          user: user,
          member: member,
          url: url,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  // send otp code for email verification
  async sendOtpCodeToEmail({ name, email, otp }) {
    try {
      const from = `${process.env.APP_NAME} <${appConfig().mail.from}>`;
      const subject = 'Email Verification';

      // add to queue
      await this.queue.add('sendOtpCodeToEmail', {
        to: email,
        from: from,
        subject: subject,
        template: 'email-verification',
        context: {
          name: name,
          otp: otp,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendVerificationLink(params: {
    email: string;
    name: string;
    token: string;
    type: string;
  }) {
    try {
      const verificationLink = `${appConfig().app.client_app_url}/verify-email?token=${params.token}&email=${params.email}&type=${params.type}`;

      // add to queue
      await this.queue.add('sendVerificationLink', {
        to: params.email,
        subject: 'Verify Your Email',
        template: './verification-link',
        context: {
          name: params.name,
          verificationLink,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendEmployeeCredentials(params: {
    email: string;
    name: string;
    password: string;
    organizationName?: string;
  }) {
    try {
      const from = `${process.env.APP_NAME} <${appConfig().mail.from}>`;
      const subject = `Welcome to ${params.organizationName || appConfig().app.name} - Your Account Credentials`;

      // add to queue
      await this.queue.add('sendEmployeeCredentials', {
        to: params.email,
        from: from,
        subject: subject,
        template: 'employee-credentials',
        context: {
          name: params.name,
          email: params.email,
          password: params.password,
          organizationName: params.organizationName || appConfig().app.name,
          loginUrl: `${appConfig().app.client_app_url}/login`,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendStaffSuspensionEmail(params: {
    email: string;
    name: string;
    rating: number;
  }) {
    try {
      const from = `${process.env.APP_NAME} <${appConfig().mail.from}>`;
      const subject = `Action required: shift application access restricted`;

      await this.queue.add('sendStaffSuspensionEmail', {
        to: params.email,
        from,
        subject,
        template: 'staff-suspension',
        context: {
          name: params.name,
          rating: params.rating,
          loginUrl: `${appConfig().app.client_app_url}/login`,
          appName: appConfig().app.name,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendCertificateExpiryEmail(params: {
    to: string;
    name: string;
    expiredCertificates: { type: string; expiry_date?: string }[];
  }) {
    try {
      const from = `${process.env.APP_NAME} <${appConfig().mail.from}>`;
      const subject = `Certificate expiry notification`;

      await this.queue.add('sendCertificateExpiryEmail', {
        to: params.to,
        from,
        subject,
        template: 'certificate-expiry',
        context: {
          name: params.name,
          expiredCertificates: params.expiredCertificates,
          appName: appConfig().app.name,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }
}
