import { Module } from '@nestjs/common';
import { ApplyShiftService } from './apply-shift.service';
import { ApplyShiftController } from './apply-shift.controller';
import { ActivityLogModule } from 'src/common/module/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [ApplyShiftController],
  providers: [ApplyShiftService],
})
export class ApplyShiftModule { }
