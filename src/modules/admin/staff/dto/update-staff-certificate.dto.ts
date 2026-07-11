import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CertificateType, CertificateVerificationStatus } from '@prisma/client';

export class UpdateStaffCertificateDto {
  @IsOptional()
  @IsEnum(CertificateType, {
    message: `certificate_type must be one of: ${Object.values(CertificateType).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'The type of certificate',
    enum: CertificateType,
    example: 'first_aid',
  })
  certificate_type?: CertificateType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Expiry date of the certificate',
    example: '2026-12-31',
  })
  expiry_date?: string;

  @IsOptional()
  @IsEnum(CertificateVerificationStatus, {
    message: `verified_status must be one of: ${Object.values(CertificateVerificationStatus).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'Verification status of the certificate',
    enum: CertificateVerificationStatus,
    example: 'verified',
  })
  verified_status?: CertificateVerificationStatus;
}
