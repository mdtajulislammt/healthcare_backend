import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UpdateStaffProfileDto } from '../../../application/staff/profile/dto/update-staff-profile.dto';

export class UpdateStaffDto extends PartialType(UpdateStaffProfileDto) {
  //   @IsOptional()
  //   @IsEmail()
  //   @ApiProperty({ description: 'Staff user email', required: false })
  //   email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password should be minimum 8 characters' })
  @ApiProperty({ description: 'New password', required: false })
  password?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Right to work status', required: false })
  right_to_work_status?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'NMC PIN', required: false })
  nmc_pin?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'DBS certificate number', required: false })
  dbs_certificate_number?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Surname as shown on DBS certificate',
    required: false,
  })
  dbs_surname_as_certificate?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    description: 'Date of birth as shown on DBS certificate',
    required: false,
  })
  dbs_date_of_birth_on_cert?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ description: 'DBS certificate print date', required: false })
  dbs_certificate_print_date?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Is registered on DBS update service',
    required: false,
  })
  dbs_is_registered_on_update?: boolean | string | number;

  @IsOptional()
  @IsNotEmpty()
  @ApiProperty({ description: 'Agree to terms', required: false })
  agreed_to_terms?: boolean;

  @IsOptional()
  @ApiProperty({
    description: 'Allow this staff to apply to shifts',
    required: false,
  })
  can_apply_to_shifts?: boolean;

  @IsOptional()
  gender?: string;

  @IsOptional()
  age?: number;
}
