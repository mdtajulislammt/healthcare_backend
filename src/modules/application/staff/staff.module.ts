import { Module } from '@nestjs/common';
import { ApplyShiftModule } from './apply-shift/apply-shift.module';


@Module({
    imports: [ApplyShiftModule],
})
export class StaffModule { }
