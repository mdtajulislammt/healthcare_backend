import { Module } from '@nestjs/common';
import { StaffReviewService } from './staff-review.service';
import { StaffReviewController } from './staff-review.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [StaffReviewController],
    providers: [StaffReviewService],
})
export class StaffReviewModule { }


