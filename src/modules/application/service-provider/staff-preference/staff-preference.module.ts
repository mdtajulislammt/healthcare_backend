import { Module } from '@nestjs/common';
import { StaffPreferenceService } from './staff-preference.service';
import { StaffPreferenceController } from './staff-preference.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ServiceProviderContextHelper } from 'src/common/helper/service-provider-context.helper';

@Module({
    imports: [PrismaModule],
    controllers: [StaffPreferenceController],
    providers: [StaffPreferenceService, ServiceProviderContextHelper],
})
export class StaffPreferenceModule { }


