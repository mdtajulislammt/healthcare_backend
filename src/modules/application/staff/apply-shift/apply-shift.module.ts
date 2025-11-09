import { Module } from '@nestjs/common';
import { ApplyShiftService } from './apply-shift.service';
import { ApplyShiftController } from './apply-shift.controller';

@Module({
  controllers: [ApplyShiftController],
  providers: [ApplyShiftService],
})
export class ApplyShiftModule {}
