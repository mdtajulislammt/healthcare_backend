import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CertificateType, CertificateVerificationStatus } from '@prisma/client';

export class UpdateStaffCertificateDto {
  @IsOptional()
  @IsEnum(CertificateType, {
    message: `certificate_type must be one of: ${Object.values(CertificateType).join(', ')}`,
  })
  certificate_type?: CertificateType;

  @IsOptional()
  @IsString()
  expiry_date?: string;

  @IsOptional()
  @IsEnum(CertificateVerificationStatus, {
    message: `verified_status must be one of: ${Object.values(CertificateVerificationStatus).join(', ')}`,
  })
  verified_status?: CertificateVerificationStatus;
}
