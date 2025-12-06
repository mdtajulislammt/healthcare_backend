import { Module } from '@nestjs/common';
import { TimesheetService } from './timesheet.service';
import { TimesheetController } from './timesheet.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { XeroModule } from 'src/modules/payment/xero/xero.module';

@Module({
    imports: [XeroModule],
    controllers: [TimesheetController],
    providers: [TimesheetService, PrismaService],
})
export class TimesheetModule { }

