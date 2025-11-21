import { Module } from '@nestjs/common';
import { ShiftModule } from './shift/shift.module';
import { ShiftApplicationModule } from './shift-application/shift-application.module';
import { ShiftTimesheetModule } from './shift-timesheet/shift-timesheet.module';
import { StaffPreferenceModule } from './staff-preference/staff-preference.module';
import { StaffReviewModule } from './staff-review/staff-review.module';
import { ProfileModule } from './profile/profile.module';
import { EmployeeModule } from './employee/employee.module';

@Module({
  imports: [
    ShiftModule,
    ShiftApplicationModule,
    ShiftTimesheetModule,
    StaffPreferenceModule,
    StaffReviewModule,
    ProfileModule,
    EmployeeModule,
  ],
})
export class ServiceProviderModule { }
