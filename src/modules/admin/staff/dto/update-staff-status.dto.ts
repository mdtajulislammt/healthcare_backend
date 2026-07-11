import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber } from 'class-validator';

export class UpdateStaffStatusDto {
  @IsNumber()
  @IsIn([0, 1, 2], {
    message: 'status must be 0 (pending), 1 (active), or 2 (suspended)',
  })
  @ApiProperty({
    description:
      'The status of the staff member (0: pending, 1: active, 2: suspended)',
    enum: [0, 1, 2],
    example: 1,
  })
  status: number;
}
