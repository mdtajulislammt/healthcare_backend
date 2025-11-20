import { Module } from '@nestjs/common';
import { ApplyShiftModule } from './apply-shift/apply-shift.module';
import { GeofenceModule } from './geofence/geofence.module';
import { ProfileModule } from './profile/profile.module';


@Module({
    imports: [ApplyShiftModule, GeofenceModule, ProfileModule],
})
export class StaffModule { }
