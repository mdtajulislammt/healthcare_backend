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
  @ApiProperty({
    description: 'Referee name',
    example: 'Jane Smith',
    required: false,
  })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Referee mobile code',
    example: '+44',
    required: false,
  })
  mobile_code?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Referee mobile number',
    example: '1234567890',
    required: false,
  })
  mobile_number?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Referee email',
    example: 'jane.smith@example.com',
    required: false,
  })
  email?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Referee role or relationship',
    example: 'Supervisor',
    required: false,
  })
  role?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    description: 'Employment start date',
    example: '2020-01-01',
    required: false,
  })
  start_date?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    description: 'Employment end date',
    example: '2022-12-31',
    required: false,
  })
  end_date?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Consent to contact referee',
    example: true,
    required: false,
  })
  consent_to_contact?: boolean | string | number;
}

export class CompleteStaffProfileDto {
  @IsNotEmpty()
  @ApiProperty({ description: 'First name', example: 'John' })
  first_name: string;

  @IsNotEmpty()
  @ApiProperty({ description: 'Last name', example: 'Doe' })
  last_name: string;

  @IsOptional()
  @ApiProperty({ description: 'Mobile code', example: '+44', required: false })
  mobile_code?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Mobile number',
    example: '1234567890',
    required: false,
  })
  mobile_number?: string;

  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({ description: 'Date of birth', example: '1995-05-15' })
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
  @ApiProperty({
    description: 'Staff roles',
    enum: ['nurse', 'senior_hca', 'hca_carer', 'support_worker'],
    isArray: true,
    required: false,
    example: ['nurse'],
  })
  roles?: ('nurse' | 'senior_hca' | 'hca_carer' | 'support_worker')[];

  @IsNotEmpty()
  @ApiProperty({ description: 'Right to work status', example: 'UK Citizen' })
  right_to_work_status: string;

  @IsOptional()
  @ApiProperty({ description: 'CV file URL', required: false })
  cv_url?: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8 characters' })
  @ApiProperty({
    description: 'User password',
    minLength: 8,
    example: 'password123',
  })
  password: string;

  @IsOptional()
  @ApiProperty({
    description: 'Agreed to terms',
    example: true,
    required: false,
  })
  agreed_to_terms?: boolean;

  @IsOptional()
  @ApiProperty({
    description: 'Work experience description',
    example: '5 years in ICU',
    required: false,
  })
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
