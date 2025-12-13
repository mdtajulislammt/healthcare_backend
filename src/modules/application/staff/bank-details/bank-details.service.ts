import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateBankDetailDto } from './dto/create-bank-detail.dto';
import { UpdateBankDetailDto } from './dto/update-bank-detail.dto';
import { calculateStaffProfileCompletion } from '../../../../common/helper/profile-completion.helper';

@Injectable()
export class BankDetailsService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Create or update bank details for authenticated staff
     */
    async createOrUpdate(userId: string, createBankDetailDto: CreateBankDetailDto) {
        // Verify user exists and get staff profile
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                staff_profile: {
                    include: {
                        bank_details: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.type !== 'staff') {
            throw new BadRequestException('User is not a staff member');
        }

        if (!user.staff_profile) {
            throw new NotFoundException('Staff profile not found. Please complete your profile first.');
        }

        const staff_id = user.staff_profile.id;
        const existingBankDetails = user.staff_profile.bank_details;

        // Upsert bank details
        const bankDetails = await this.prisma.staffBankDetails.upsert({
            where: { staff_id },
            update: {
                account_holder_name: createBankDetailDto.account_holder_name,
                sort_code: createBankDetailDto.sort_code,
                account_number: createBankDetailDto.account_number,bank_name: createBankDetailDto.bank_name ?? null,
                is_verified: false, // Reset verification on update
            },   create: {
                staff_id,
                account_holder_name: createBankDetailDto.account_holder_name,
                sort_code: createBankDetailDto.sort_code,
                account_number: createBankDetailDto.account_number,
                bank_name: createBankDetailDto.bank_name ?? null,
            },
        });

        // Recalculate profile completion
        await this.recalculateProfileCompletion(staff_id);

        return {
            success: true,
            message: existingBankDetails
                ? 'Bank details updated successfully'
                : 'Bank details created successfully',
            data: {
                id: bankDetails.id,
                account_holder_name: bankDetails.account_holder_name,
                sort_code: bankDetails.sort_code,
                account_number: this.maskAccountNumber(bankDetails.account_number),
                bank_name: bankDetails.bank_name,
                is_verified: bankDetails.is_verified,
                created_at: bankDetails.created_at,
                updated_at: bankDetails.updated_at,
            },
        };
    }

    /**
     * Get bank details for authenticated staff
     */
    async findByUser(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                staff_profile: {
                    include: {
                        bank_details: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.type !== 'staff') {
            throw new BadRequestException('User is not a staff member');
        }

        if (!user.staff_profile) {
            throw new NotFoundException('Staff profile not found');
        }

        const bankDetails = user.staff_profile.bank_details;

        if (!bankDetails) {
            return {
                success: true,
                message: 'No bank details found',
                data: null,
            };
        }

        return {
            success: true,
            message: 'Bank details fetched successfully',
            data: {
                id: bankDetails.id,
                account_holder_name: bankDetails.account_holder_name,
                sort_code: bankDetails.sort_code,
                account_number: this.maskAccountNumber(bankDetails.account_number),
                bank_name: bankDetails.bank_name,
                is_verified: bankDetails.is_verified,
                created_at: bankDetails.created_at,
                updated_at: bankDetails.updated_at,
            },
        };
    }

    /**
     * Delete bank details for authenticated staff
     */
    async remove(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                staff_profile: {
                    include: {
                        bank_details: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.type !== 'staff') {
            throw new BadRequestException('User is not a staff member');
        }

        if (!user.staff_profile) {
            throw new NotFoundException('Staff profile not found');
        }

        if (!user.staff_profile.bank_details) {
            throw new NotFoundException('Bank details not found');
        }

        const staff_id = user.staff_profile.id;

        await this.prisma.staffBankDetails.delete({
            where: { staff_id },
        });

        // Recalculate profile completion after deletion
        await this.recalculateProfileCompletion(staff_id);

        return {
            success: true,
            message: 'Bank details deleted successfully',
        };
    }

    /**
     * Mask account number for display (show last 4 digits only)
     */
    private maskAccountNumber(accountNumber: string): string {
        if (accountNumber.length <= 4) {
            return accountNumber;
        }
        return '****' + accountNumber.slice(-4);
    }

    /**
     * Recalculate and update profile completion for a staff member
     */
    private async recalculateProfileCompletion(staff_id: string) {
        const staffProfileWithRelations = await this.prisma.staffProfile.findUnique({
            where: { id: staff_id },
            include: {
                certificates: true,
                dbs_info: true,
                emergency_contacts: true,
                current_address: true,
                previous_address: true,
                educations: true,
                bank_details: true,
            },
        });

        if (staffProfileWithRelations) {
            const completionResult = calculateStaffProfileCompletion(staffProfileWithRelations);
            await this.prisma.staffProfile.update({
                where: { id: staff_id },
                data: {
                    profile_completion: completionResult.profile_completion,
                    is_profile_complete: completionResult.is_profile_complete,
                },
            });
            return completionResult;
        }
        return null;
    }
}
