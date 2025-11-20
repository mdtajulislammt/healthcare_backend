import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { CreateUpdateEducationDto } from './dto/create-update-education.dto';
import { CreateUpdateCertificateDto } from './dto/create-update-certificate.dto';
import { UpdateDbsInfoDto } from './dto/update-dbs-info.dto';
import { SojebStorage } from '../../../../common/lib/Disk/SojebStorage';
import appConfig from '../../../../config/app.config';
import { StringHelper } from '../../../../common/helper/string.helper';
import { calculateStaffProfileCompletion } from '../../../../common/helper/profile-completion.helper';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Recalculate and update profile completion for a staff member
   * @param staff_id - The staff profile ID
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

  create(createProfileDto: CreateProfileDto) {
    return 'This action adds a new profile';
  }

  findAll() {
    return `This action returns all profile`;
  }

  findOne(id: number) {
    return `This action returns a #${id} profile`;
  }

  update(id: number, updateProfileDto: UpdateProfileDto) {
    return `This action updates a #${id} profile`;
  }

  remove(id: number) {
    return `This action removes a #${id} profile`;
  }

  /**
   * Update staff personal info and roles
   * @param userId - The user ID from the authenticated request
   * @param updateData - The data to update
   * @param photoFile - Optional photo file
   * @param cvFile - Optional CV file
   * @param currentAddressEvidenceFile - Optional current address evidence file (utility bill, bank statement, etc.)
   */
  async updateStaffProfile(
    userId: string,
    updateData: UpdateStaffProfileDto,
    photoFile?: Express.Multer.File,
    cvFile?: Express.Multer.File,
    currentAddressEvidenceFile?: Express.Multer.File,
  ) {
    try {

      // Verify user exists and get staff profile
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          staff_profile: true,
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
      const existingPhotoUrl = user.staff_profile.photo_url;
      const existingCvUrl = user.staff_profile.cv_url;

      // Get existing current address to check for old evidence file
      const existingCurrentAddress = await this.prisma.staffCurrentAddress.findUnique({
        where: { staff_id },
      });
      const existingEvidenceUrl = existingCurrentAddress?.evidence_file_url;

      // Upload files first (external operations - can't rollback)
      let staffPhotoFileName: string | undefined = undefined;
      if (photoFile) {
        // Delete old photo if exists
        if (existingPhotoUrl) {
          try {
            await SojebStorage.delete(appConfig().storageUrl.staff + existingPhotoUrl);
          } catch (error) {
            // Continue even if deletion fails
            console.error('Failed to delete old photo:', error);
          }
        }
        // Upload new photo
        staffPhotoFileName = `${StringHelper.randomString()}${photoFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.staff + staffPhotoFileName,
          photoFile.buffer,
        );
      }

      let staffCvFileName: string | undefined = undefined;
      if (cvFile) {
        // Delete old CV if exists
        if (existingCvUrl) {
          try {
            await SojebStorage.delete(appConfig().storageUrl.cv + existingCvUrl);
          } catch (error) {
            // Continue even if deletion fails
            console.error('Failed to delete old CV:', error);
          }
        }
        // Upload new CV
        staffCvFileName = `${StringHelper.randomString()}${cvFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.cv + staffCvFileName,
          cvFile.buffer,
        );
      }

      // Upload current address evidence file if provided
      let currentAddressEvidenceFileName: string | undefined = undefined;
      if (currentAddressEvidenceFile) {
        // Delete old evidence file if exists
        if (existingEvidenceUrl) {
          try {
            await SojebStorage.delete(appConfig().storageUrl.certificate + existingEvidenceUrl);
          } catch (error) {
            // Continue even if deletion fails
            console.error('Failed to delete old current address evidence:', error);
          }
        }
        // Upload new evidence file
        currentAddressEvidenceFileName = `${StringHelper.randomString()}${currentAddressEvidenceFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.certificate + currentAddressEvidenceFileName,
          currentAddressEvidenceFile.buffer,
        );
      }

      // Prepare update data
      const updatePayload: any = {};

      if (updateData.first_name !== undefined) {
        updatePayload.first_name = updateData.first_name;
      }

      if (updateData.last_name !== undefined) {
        updatePayload.last_name = updateData.last_name;
      }

      if (updateData.mobile_code !== undefined) {
        updatePayload.mobile_code = updateData.mobile_code;
      }

      if (updateData.mobile_number !== undefined) {
        updatePayload.mobile_number = updateData.mobile_number;
      }

      if (updateData.date_of_birth !== undefined) {
        updatePayload.date_of_birth = new Date(updateData.date_of_birth);
      }

      if (updateData.experience !== undefined) {
        updatePayload.experience = updateData.experience;
      }

      if (updateData.bio !== undefined) {
        updatePayload.bio = updateData.bio;
      }

      // Update photo URL if new file uploaded
      if (staffPhotoFileName !== undefined) {
        updatePayload.photo_url = staffPhotoFileName;
      }

      // Update CV URL if new file uploaded
      if (staffCvFileName !== undefined) {
        updatePayload.cv_url = staffCvFileName;
      }

      // Handle roles update
      if (updateData.roles !== undefined) {
        // Validate roles - roles should already be an array from DTO
        const rolesArray = Array.isArray(updateData.roles) ? updateData.roles : [];
        const allowedRoles = ['nurse', 'senior_hca', 'hca_carer', 'support_worker'];
        const validRoles = rolesArray.filter((role: string) => allowedRoles.includes(role));

        // Allow empty array to clear roles or set valid roles
        updatePayload.roles = validRoles as any;
      }

      // Execute all updates in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Update staff profile
        const updatedProfile = await tx.staffProfile.update({
          where: { user_id: userId },
          data: updatePayload,
          select: {
            id: true,
            user_id: true,
            first_name: true,
            last_name: true,
            mobile_code: true,
            mobile_number: true,
            date_of_birth: true,
            roles: true,
            experience: true,
            bio: true,
            photo_url: true,
            cv_url: true,
            updated_at: true,
          },
        });

        // Handle Emergency Contact - upsert
        let emergencyContact = null;
        if (updateData.emergency_contact) {
          const emergencyData = updateData.emergency_contact;

          // Validate required fields for emergency contact
          if (emergencyData.mobile_code === undefined || emergencyData.mobile_number === undefined) {
            throw new BadRequestException('Emergency contact mobile_code and mobile_number are required');
          }

          emergencyContact = await tx.staffEmergencyContact.upsert({
            where: { staff_id },
            update: {
              name: emergencyData.name ?? undefined,
              mobile_code: emergencyData.mobile_code,
              mobile_number: emergencyData.mobile_number,
              relationship: emergencyData.relationship ?? undefined,
            },
            create: {
              staff_id,
              name: emergencyData.name ?? null,
              mobile_code: emergencyData.mobile_code,
              mobile_number: emergencyData.mobile_number,
              relationship: emergencyData.relationship ?? null,
            },
          });
        }

        // Handle Current Address - upsert
        let currentAddress = null;
        if (updateData.current_address) {
          const addressData = updateData.current_address;

          // Validate required fields for current address
          if (addressData.address === undefined) {
            throw new BadRequestException('Current address is required');
          }

          const currentAddressUpdateData: any = {
            address: addressData.address,
            city: addressData.city ?? undefined,
            state: addressData.state ?? undefined,
            zip: addressData.zip ?? undefined,
            country: addressData.country ?? undefined,
            from_date: addressData.from_date ? new Date(addressData.from_date) : undefined,
            to_date: addressData.to_date ? new Date(addressData.to_date) : undefined,
          };

          // Update evidence_file_url if new file uploaded
          if (currentAddressEvidenceFileName !== undefined) {
            currentAddressUpdateData.evidence_file_url = currentAddressEvidenceFileName;
          }

          currentAddress = await tx.staffCurrentAddress.upsert({
            where: { staff_id },
            update: currentAddressUpdateData,
            create: {
              staff_id,
              address: addressData.address,
              city: addressData.city ?? null,
              state: addressData.state ?? null,
              zip: addressData.zip ?? null,
              country: addressData.country ?? null,
              from_date: addressData.from_date ? new Date(addressData.from_date) : null,
              to_date: addressData.to_date ? new Date(addressData.to_date) : null,
              evidence_file_url: currentAddressEvidenceFileName ?? null,
            },
          });
        } else if (currentAddressEvidenceFile) {
          // If only evidence file is provided without address data, update existing address
          if (existingCurrentAddress) {
            currentAddress = await tx.staffCurrentAddress.update({
              where: { staff_id },
              data: {
                evidence_file_url: currentAddressEvidenceFileName,
              },
            });
          } else {
            throw new BadRequestException('Current address must be provided before uploading evidence file');
          }
        }

        // Handle Previous Address - upsert
        let previousAddress = null;
        if (updateData.previous_address) {
          const addressData = updateData.previous_address;

          // Validate required fields for previous address
          if (addressData.address === undefined) {
            throw new BadRequestException('Previous address is required');
          }

          previousAddress = await tx.staffPreviousAddress.upsert({
            where: { staff_id },
            update: {
              address: addressData.address,
              city: addressData.city ?? undefined,
              state: addressData.state ?? undefined,
              zip: addressData.zip ?? undefined,
              country: addressData.country ?? undefined,
              from_date: addressData.from_date ? new Date(addressData.from_date) : undefined,
              to_date: addressData.to_date ? new Date(addressData.to_date) : undefined,
            },
            create: {
              staff_id,
              address: addressData.address,
              city: addressData.city ?? null,
              state: addressData.state ?? null,
              zip: addressData.zip ?? null,
              country: addressData.country ?? null,
              from_date: addressData.from_date ? new Date(addressData.from_date) : null,
              to_date: addressData.to_date ? new Date(addressData.to_date) : null,
            },
          });
        }

        return {
          profile: updatedProfile,
          emergencyContact,
          currentAddress,
          previousAddress,
        };
      });

      // Recalculate profile completion after updates
      await this.recalculateProfileCompletion(staff_id);

      // Fetch updated profile with completion data
      const finalProfile = await this.prisma.staffProfile.findUnique({
        where: { user_id: userId },
        select: {
          id: true,
          user_id: true,
          first_name: true,
          last_name: true,
          mobile_code: true,
          mobile_number: true,
          date_of_birth: true,
          roles: true,
          experience: true,
          bio: true,
          photo_url: true,
          cv_url: true,
          profile_completion: true,
          is_profile_complete: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Staff profile updated successfully',
        data: {
          profile: finalProfile || result.profile,
          emergency_contact: result.emergencyContact,
          current_address: result.currentAddress,
          previous_address: result.previousAddress,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update staff profile: ${error.message}`);
    }
  }

  /**
   * Create or update staff education
   * @param userId - The user ID from the authenticated request
   * @param educationData - The education data
   */
  async createOrUpdateEducation(userId: string, educationData: CreateUpdateEducationDto) {
    try {
      // Verify user exists and get staff profile
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          staff_profile: true,
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

      // Validate required fields
      if (!educationData.institution_name || !educationData.degree) {
        throw new BadRequestException('Institution name and degree are required');
      }

      // Prepare education data
      const educationPayload: any = {
        staff_id,
        institution_name: educationData.institution_name,
        degree: educationData.degree,
        field_of_study: educationData.field_of_study ?? null,
        start_date: educationData.start_date ? new Date(educationData.start_date) : null,
        end_date: educationData.end_date ? new Date(educationData.end_date) : null,
      };

      let education;

      // If ID is provided, update existing education
      if (educationData.id) {
        // Verify the education belongs to this staff
        const existingEducation = await this.prisma.staffEducation.findUnique({
          where: { id: educationData.id },
        });

        if (!existingEducation) {
          throw new NotFoundException('Education record not found');
        }

        if (existingEducation.staff_id !== staff_id) {
          throw new BadRequestException('This education record does not belong to you');
        }

        // Update existing education
        education = await this.prisma.staffEducation.update({
          where: { id: educationData.id },
          data: educationPayload,
        });
      } else {
        // Create new education
        education = await this.prisma.staffEducation.create({
          data: educationPayload,
        });
      }

      // Recalculate profile completion after education update
      await this.recalculateProfileCompletion(staff_id);

      return {
        success: true,
        message: educationData.id ? 'Education updated successfully' : 'Education created successfully',
        data: education,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to ${educationData.id ? 'update' : 'create'} education: ${error.message}`);
    }
  }

  /**
   * Create or update staff certificate
   * @param userId - The user ID from the authenticated request
   * @param certificateData - The certificate data
   * @param certificateFile - Optional certificate file
   */
  async createOrUpdateCertificate(
    userId: string,
    certificateData: CreateUpdateCertificateDto,
    certificateFile?: Express.Multer.File,
  ) {
    try {
      // Verify user exists and get staff profile
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          staff_profile: true,
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

      // Validate certificate type
      const allowedTypes = [
        'care_certificate',
        'moving_handling',
        'first_aid',
        'basic_life_support',
        'infection_control',
        'safeguarding',
        'health_safety',
        'equality_diversity',
        'coshh',
        'medication_training',
        'nvq_iii',
        'additional_training',
      ];

      if (!allowedTypes.includes(certificateData.certificate_type)) {
        throw new BadRequestException('Invalid certificate type');
      }

      // Upload file if provided
      let certificateFileName: string | undefined = undefined;
      let existingCertificate = null;

      // If ID is provided, get existing certificate
      if (certificateData.id) {
        existingCertificate = await this.prisma.staffCertificate.findUnique({
          where: { id: certificateData.id },
        });

        if (!existingCertificate) {
          throw new NotFoundException('Certificate not found');
        }

        if (existingCertificate.staff_id !== staff_id) {
          throw new BadRequestException('This certificate does not belong to you');
        }

        // Delete old file if new file is uploaded
        if (certificateFile && existingCertificate.file_url) {
          try {
            await SojebStorage.delete(appConfig().storageUrl.certificate + existingCertificate.file_url);
          } catch (error) {
            console.error('Failed to delete old certificate file:', error);
          }
        }
      } else {
        // If no ID, check if certificate with this type already exists
        existingCertificate = await this.prisma.staffCertificate.findFirst({
          where: {
            staff_id,
            certificate_type: certificateData.certificate_type as any,
          },
        });

        // If exists and file is being uploaded, delete old file
        if (existingCertificate && certificateFile && existingCertificate.file_url) {
          try {
            await SojebStorage.delete(appConfig().storageUrl.certificate + existingCertificate.file_url);
          } catch (error) {
            console.error('Failed to delete old certificate file:', error);
          }
        }
      }

      // Upload new file if provided
      if (certificateFile) {
        certificateFileName = `${StringHelper.randomString()}${certificateFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.certificate + certificateFileName,
          certificateFile.buffer,
        );
      }

      // Prepare certificate data
      const certificatePayload: any = {
        staff_id,
        certificate_type: certificateData.certificate_type as any,
      };

      if (certificateFileName !== undefined) {
        certificatePayload.file_url = certificateFileName;
      }

      if (certificateData.expiry_date) {
        certificatePayload.expiry_date = new Date(certificateData.expiry_date);
      }

      let certificate;

      // Update existing certificate
      if (existingCertificate) {
        // If file URL is not being updated, keep the existing one
        if (certificateFileName === undefined && existingCertificate.file_url) {
          certificatePayload.file_url = existingCertificate.file_url;
        }

        certificate = await this.prisma.staffCertificate.update({
          where: { id: existingCertificate.id },
          data: certificatePayload,
        });
      } else {
        // Create new certificate
        certificate = await this.prisma.staffCertificate.create({
          data: certificatePayload,
        });
      }

      // Recalculate profile completion after certificate update
      await this.recalculateProfileCompletion(staff_id);

      return {
        success: true,
        message: existingCertificate ? 'Certificate updated successfully' : 'Certificate created successfully',
        data: certificate,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to ${certificateData.id || 'update'} certificate: ${error.message}`);
    }
  }

  /**
   * Update staff DBS info
   * @param userId - The user ID from the authenticated request
   * @param dbsData - The DBS data to update
   */
  async updateDbsInfo(userId: string, dbsData: UpdateDbsInfoDto) {
    try {
      // Verify user exists and get staff profile
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          staff_profile: true,
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

      // Check if DBS info exists
      const existingDbsInfo = await this.prisma.staffDbsInfo.findUnique({
        where: { staff_id },
      });

      if (!existingDbsInfo) {
        throw new NotFoundException('DBS info not found. Please create DBS info first.');
      }

      // Prepare update data
      const updatePayload: any = {};

      if (dbsData.certificate_number !== undefined) {
        updatePayload.certificate_number = dbsData.certificate_number;
      }

      if (dbsData.surname_as_certificate !== undefined) {
        updatePayload.surname_as_certificate = dbsData.surname_as_certificate;
      }

      if (dbsData.date_of_birth_on_cert !== undefined) {
        const dobString = String(dbsData.date_of_birth_on_cert).trim();
        if (!dobString || dobString === 'undefined' || dobString === 'null') {
          throw new BadRequestException('date_of_birth_on_cert is required and must be a valid date in YYYY-MM-DD format.');
        }
        const dobDate = new Date(dobString);
        if (isNaN(dobDate.getTime())) {
          throw new BadRequestException(`Invalid date format for date_of_birth_on_cert: "${dobString}". Please use YYYY-MM-DD format (e.g., 1990-01-01).`);
        }
        updatePayload.date_of_birth_on_cert = dobDate;
      }

      if (dbsData.certificate_print_date !== undefined) {
        const printString = String(dbsData.certificate_print_date).trim();
        if (!printString || printString === 'undefined' || printString === 'null') {
          throw new BadRequestException('certificate_print_date is required and must be a valid date in YYYY-MM-DD format.');
        }
        const printDate = new Date(printString);
        if (isNaN(printDate.getTime())) {
          throw new BadRequestException(`Invalid date format for certificate_print_date: "${printString}". Please use YYYY-MM-DD format (e.g., 2024-01-15).`);
        }
        updatePayload.certificate_print_date = printDate;
      }

      if (dbsData.is_registered_on_update !== undefined) {
        // Normalize is_registered_on_update
        let isRegistered = false;
        if (typeof dbsData.is_registered_on_update === 'boolean') {
          isRegistered = dbsData.is_registered_on_update;
        } else if (typeof dbsData.is_registered_on_update === 'number') {
          isRegistered = dbsData.is_registered_on_update === 1;
        } else if (typeof dbsData.is_registered_on_update === 'string') {
          const value = String(dbsData.is_registered_on_update).trim().toLowerCase();
          isRegistered = ['true', '1', 'yes'].includes(value);
        }
        updatePayload.is_registered_on_update = isRegistered;
      }

      // Update DBS info
      const updatedDbsInfo = await this.prisma.staffDbsInfo.update({
        where: { staff_id },
        data: updatePayload,
      });

      // Recalculate profile completion after DBS info update
      await this.recalculateProfileCompletion(staff_id);

      return {
        success: true,
        message: 'DBS info updated successfully',
        data: updatedDbsInfo,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update DBS info: ${error.message}`);
    }
  }

  /**
   * Get staff profile with all related data
   * @param userId - The user ID from the authenticated request
   */
  async getStaffProfile(userId: string) {
    try {
      // Verify user exists and get staff profile with all relations
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          staff_profile: {
            include: {
              certificates: {
                orderBy: { uploaded_at: 'desc' },
              },
              dbs_info: true,
              emergency_contacts: true,
              current_address: true,
              previous_address: true,
              educations: {
                orderBy: { created_at: 'desc' },
              },
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

      const profile = user.staff_profile;

      // Format file URLs
      if (profile.photo_url) {
        profile.photo_url = SojebStorage.url(
          appConfig().storageUrl.staff + profile.photo_url,
        );
      }

      if (profile.cv_url) {
        profile.cv_url = SojebStorage.url(
          appConfig().storageUrl.cv + profile.cv_url,
        );
      }

      // Format certificate file URLs
      if (profile.certificates && profile.certificates.length > 0) {
        for (const cert of profile.certificates) {
          if (cert.file_url) {
            cert.file_url = SojebStorage.url(
              appConfig().storageUrl.certificate + cert.file_url,
            );
          }
        }
      }

      // Format current address evidence file URL
      if (profile.current_address && profile.current_address.evidence_file_url) {
        profile.current_address.evidence_file_url = SojebStorage.url(
          appConfig().storageUrl.certificate + profile.current_address.evidence_file_url,
        );
      }

      // Include user info (without sensitive data)
      const userInfo = {
        id: user.id,
        email: user.email,
        status: user.status,
        email_verified_at: user.email_verified_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };

      return {
        success: true,
        message: 'Staff profile fetched successfully',
        data: {
          ...profile,
          user: userInfo,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch staff profile: ${error.message}`);
    }
  }
}
