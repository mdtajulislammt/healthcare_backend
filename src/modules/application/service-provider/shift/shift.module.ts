import { Module } from '@nestjs/common';
import { ShiftService } from './shift.service';
import { ShiftController } from './shift.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ActivityLogModule } from 'src/common/module/activity-log.module';
import { ServiceProviderContextHelper } from 'src/common/helper/service-provider-context.helper';

@Module({
  imports: [PrismaModule, ActivityLogModule],
  controllers: [ShiftController],
  providers: [ShiftService, ServiceProviderContextHelper],
})
export class ShiftModule { }
