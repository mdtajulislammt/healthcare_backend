import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { StaffCertificateExpiryService } from './utils/staff-certificate-expiry.service';

@Module({
  controllers: [StaffController],
  providers: [StaffService, StaffCertificateExpiryService],
})
export class StaffModule {}
