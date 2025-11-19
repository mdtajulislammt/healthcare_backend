import { Module } from '@nestjs/common';
import { ApplyShiftModule } from './apply-shift/apply-shift.module';
import { GeofenceModule } from './geofence/geofence.module';


@Module({
    imports: [ApplyShiftModule, GeofenceModule],
})
export class StaffModule { }
