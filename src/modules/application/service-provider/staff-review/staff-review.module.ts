import { Module } from '@nestjs/common';
import { StaffReviewService } from './staff-review.service';
import { StaffReviewController } from './staff-review.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ServiceProviderContextHelper } from 'src/common/helper/service-provider-context.helper';

@Module({
    imports: [PrismaModule],
    controllers: [StaffReviewController],
    providers: [StaffReviewService, ServiceProviderContextHelper],
})
export class StaffReviewModule { }


