import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { ShiftModule } from './shift/shift.module';

@Module({
  imports: [NotificationModule, ContactModule, FaqModule, ShiftModule],
})
export class ApplicationModule {}
