import { Module } from '@nestjs/common';
import { StaffPreferenceService } from './staff-preference.service';
import { StaffPreferenceController } from './staff-preference.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [StaffPreferenceController],
    providers: [StaffPreferenceService],
})
export class StaffPreferenceModule { }


