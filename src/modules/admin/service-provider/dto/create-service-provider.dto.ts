import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
  MinLength,
} from 'class-validator';
import { CompleteServiceProviderProfileDto } from '../../../auth/dto/complete-service-provider-profile.dto';

export class CreateServiceProviderDto extends CompleteServiceProviderProfileDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({ description: 'Service provider user email' })
  email: string;

  @IsOptional()
  @ApiProperty({ description: 'Brand logo URL', required: false })
  brand_logo_url?: string;
}
