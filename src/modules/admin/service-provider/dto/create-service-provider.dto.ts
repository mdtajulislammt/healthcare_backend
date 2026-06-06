import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { CompleteServiceProviderProfileDto } from '../../../auth/dto/complete-service-provider-profile.dto';

export class CreateServiceProviderDto extends CompleteServiceProviderProfileDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({ description: 'Service provider user email' })
  email: string;

  @IsOptional()
  @ApiProperty({ description: 'Brand logo URL', required: false })
  brand_logo_url?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Secondary mobile code',
    example: '+44',
    required: false,
  })
  second_mobile_code?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Secondary mobile number',
    example: '1234567890',
    required: false,
  })
  second_mobile_number?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Register manager name',
    example: 'John Doe',
    required: false,
  })
  register_manager_name?: string;
}
