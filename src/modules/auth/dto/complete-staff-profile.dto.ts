import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RefereeInfoDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  mobile_code?: string;

  @IsOptional()
  @IsString()
  mobile_number?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  consent_to_contact?: boolean | string | number;
}

export class CompleteStaffProfileDto {
  @IsNotEmpty()
  first_name: string;

  @IsNotEmpty()
  last_name: string;

  @IsOptional()
  mobile_code?: string;

  @IsOptional()
  mobile_number?: string;

  @IsNotEmpty()
  @IsDateString()
  date_of_birth: string;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const rawValue = value.trim();

      try {
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return rawValue
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    return [value];
  })
  @IsOptional()
  @IsIn(['nurse', 'senior_hca', 'hca_carer', 'support_worker'], { each: true })
  roles?: ('nurse' | 'senior_hca' | 'hca_carer' | 'support_worker')[];

  @IsNotEmpty()
  right_to_work_status: string;

  @IsOptional()
  cv_url?: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8 characters' })
  password: string;

  @IsOptional()
  agreed_to_terms?: boolean;

  @IsOptional()
  experience?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'NMC PIN', required: false })
  nmc_pin?: string;

  // Optional: DBS Info
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
  @Transform(({ value, obj }) => {
    const rawValue = value ?? obj?.dto ?? obj?.referee_info ?? obj?.refereeInfo;

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return undefined;
    }

    if (typeof rawValue === 'string') {
      const normalizeJsonString = (input: string) =>
        input.trim().replace(/,\s*([}\]])/g, '$1');

      try {
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        try {
          const parsed = JSON.parse(normalizeJsonString(rawValue));
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return undefined;
        }
      }
    }

    return Array.isArray(rawValue) ? rawValue : [rawValue];
  })
  @Type(() => RefereeInfoDto)
  @ValidateNested({ each: true })
  @IsArray()
  @ApiProperty({
    description: 'Multiple referees',
    required: false,
    type: [RefereeInfoDto],
  })
  referees?: RefereeInfoDto[];
}
