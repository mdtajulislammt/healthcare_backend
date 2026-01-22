import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationModule as AppNotificationModule } from '../../application/notification/notification.module';

@Module({
  imports: [AppNotificationModule],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
