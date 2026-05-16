import { Module } from '@nestjs/common';
import { ShiftTimesheetService } from './shift-timesheet.service';
import { ShiftTimesheetController } from './shift-timesheet.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ServiceProviderContextHelper } from 'src/common/helper/service-provider-context.helper';
import { NotificationModule } from 'src/modules/application/notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ShiftTimesheetController],
  providers: [ShiftTimesheetService, ServiceProviderContextHelper],
})
export class ShiftTimesheetModule {}
