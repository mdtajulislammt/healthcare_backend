import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateCertificateStatusDto {
  @IsString()
  @IsIn(['pending', 'verified', 'rejected'], {
    message: 'verified_status must be one of pending, verified, rejected',
  })
  @ApiProperty({
    description: 'The verification status of the certificate',
    enum: ['pending', 'verified', 'rejected'],
    example: 'verified',
  })
  verified_status: 'pending' | 'verified' | 'rejected';
}
