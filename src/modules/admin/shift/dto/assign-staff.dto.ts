import { IsNotEmpty, IsString } from 'class-validator';

export class AssignStaffDto {
  @IsNotEmpty()
  @IsString()
  staff_id: string;
}
