import { Module } from '@nestjs/common';
import { ShiftTimesheetService } from './shift-timesheet.service';
import { ShiftTimesheetController } from './shift-timesheet.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShiftTimesheetController],
  providers: [ShiftTimesheetService],
})
export class ShiftTimesheetModule { }
