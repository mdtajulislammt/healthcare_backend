import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { ServiceProviderModule } from './service-provider/service-provider.module';
import { StaffModule } from './staff/staff.module';
import { DeviceModule } from './device/device.module';

@Module({
  imports: [
    NotificationModule,
    ContactModule,
    FaqModule,
    ServiceProviderModule,
    StaffModule,
    DeviceModule,
  ],
})
export class ApplicationModule { }
