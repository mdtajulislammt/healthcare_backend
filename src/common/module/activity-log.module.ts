import { Global, Module } from '@nestjs/common';
import { ActivityLogService } from '../service/activity-log.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Global()
@Module({
    providers: [ActivityLogService, PrismaService],
    exports: [ActivityLogService],
})
export class ActivityLogModule { }

