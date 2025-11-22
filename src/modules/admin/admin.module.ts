import { Module } from '@nestjs/common';
import { FaqModule } from './faq/faq.module';
import { ContactModule } from './contact/contact.module';
import { WebsiteInfoModule } from './website-info/website-info.module';
import { PaymentTransactionModule } from './payment-transaction/payment-transaction.module';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { StaffModule } from './staff/staff.module';
import { ServiceProviderModule } from './service-provider/service-provider.module';
import { ShiftModule } from './shift/shift.module';
import { TimesheetModule } from './timesheet/timesheet.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    FaqModule,
    ContactModule,
    WebsiteInfoModule,
    PaymentTransactionModule,
    UserModule,
    NotificationModule,
    StaffModule,
    ServiceProviderModule,
    ShiftModule,
    TimesheetModule,
    DashboardModule,
  ],
})
export class AdminModule { }
