import { IsIn, IsNotEmpty } from 'class-validator';
import { ReviewStatus } from '@prisma/client';

import { ApiProperty } from '@nestjs/swagger';

export class UpdateReviewStatusDto {
  @IsNotEmpty()
  @IsIn(['pending', 'approved', 'rejected'])
  @ApiProperty({
    description: 'The updated status of the review',
    enum: ['pending', 'approved', 'rejected'],
    example: 'approved',
  })
  status: ReviewStatus;
}
