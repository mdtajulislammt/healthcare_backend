import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { CompleteStaffProfileDto } from '../../../auth/dto/complete-staff-profile.dto';

export class CreateStaffDto extends CompleteStaffProfileDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({ description: 'Staff user email' })
  email: string;

  @IsOptional()
  gender?: string;

  @IsOptional()
  age?: number;
}
