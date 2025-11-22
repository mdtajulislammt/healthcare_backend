import { Module } from '@nestjs/common';
import { TimesheetService } from './timesheet.service';
import { TimesheetController } from './timesheet.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
    controllers: [TimesheetController],
    providers: [TimesheetService, PrismaService],
})
export class TimesheetModule { }

