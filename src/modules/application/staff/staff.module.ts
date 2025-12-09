import { Module } from '@nestjs/common';
import { ApplyShiftModule } from './apply-shift/apply-shift.module';
import { GeofenceModule } from './geofence/geofence.module';
import { ProfileModule } from './profile/profile.module';
import { HomeModule } from './home/home.module';
import { BankDetailsModule } from './bank-details/bank-details.module';


@Module({
    imports: [ApplyShiftModule, GeofenceModule, ProfileModule, HomeModule, BankDetailsModule],
})
export class StaffModule { }
