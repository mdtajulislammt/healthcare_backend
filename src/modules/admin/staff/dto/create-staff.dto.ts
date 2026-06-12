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

  @IsOptional()
  @ApiProperty({
    description:
      'JSON map of certificate types to expiry dates (e.g. {"first_aid":"2026-12-31"})',
    required: false,
  })
  certificate_expiries?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Allow this staff to apply to shifts',
    required: false,
  })
  can_apply_to_shifts?: boolean;
}
