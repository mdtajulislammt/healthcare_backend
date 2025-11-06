import { IsIn, IsNumber } from 'class-validator';

export class UpdateStaffStatusDto {
    @IsNumber()
    @IsIn([0, 1, 2], { message: 'status must be 0 (pending), 1 (active), or 2 (suspended)' })
    status: number;
}


