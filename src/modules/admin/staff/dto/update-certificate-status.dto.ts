import { IsIn, IsString } from 'class-validator';

export class UpdateCertificateStatusDto {
    @IsString()
    @IsIn(['pending', 'verified', 'rejected'], {
        message: 'verified_status must be one of pending, verified, rejected',
    })
    verified_status: 'pending' | 'verified' | 'rejected';
}


