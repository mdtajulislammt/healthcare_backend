import { IsIn, IsNotEmpty } from 'class-validator';
import { ReviewStatus } from '@prisma/client';

export class UpdateReviewStatusDto {
  @IsNotEmpty()
  @IsIn(['pending', 'approved', 'rejected'])
  status: ReviewStatus;
}
