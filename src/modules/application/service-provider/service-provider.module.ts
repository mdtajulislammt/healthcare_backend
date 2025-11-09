import { Module } from '@nestjs/common';
import { ShiftModule } from './shift/shift.module';
import { ShiftApplicationModule } from './shift-application/shift-application.module';


@Module({
  imports: [ShiftModule, ShiftApplicationModule],
})
export class ServiceProviderModule {}
