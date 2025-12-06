import { Global, Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseAdminProvider } from '../lib/Firebase/firebase-admin.provider';
import { PushNotificationService } from '../service/push-notification.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [FirebaseAdminProvider, PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}


