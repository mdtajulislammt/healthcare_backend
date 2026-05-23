import { Module } from '@nestjs/common';
import { StaffReviewService } from './staff-review.service';
import { StaffReviewController } from './staff-review.controller';

@Module({
  controllers: [StaffReviewController],
  providers: [StaffReviewService],
})
export class StaffReviewModule {}
