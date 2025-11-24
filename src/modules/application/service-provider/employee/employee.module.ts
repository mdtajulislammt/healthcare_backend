import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { MailModule } from 'src/mail/mail.module';
import { ActivityLogModule } from 'src/common/module/activity-log.module';

@Module({
  imports: [MailModule, ActivityLogModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule { }
