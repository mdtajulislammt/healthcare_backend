import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateServiceProviderProfileDto } from './dto/update-service-provider-profile.dto';
import { UpdateBusinessInfoDto } from './dto/update-business-info.dto';
import { SojebStorage } from '../../../../common/lib/Disk/SojebStorage';
import appConfig from '../../../../config/app.config';
import { StringHelper } from '../../../../common/helper/string.helper';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) { }

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
   * Update service provider profile info
   * @param userId - The user ID from the authenticated request
   * @param updateData - The data to update
   * @param brandLogoFile - Optional file for brand logo
   */
  async updateServiceProviderProfile(
    userId: string,
    updateData: UpdateServiceProviderProfileDto,
    brandLogoFile?: Express.Multer.File,
  ) {
    try {
      // Verify user exists and get service provider profile
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          service_provider_info: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.type !== 'service_provider') {
        throw new BadRequestException('User is not a service provider');
      }

      if (!user.service_provider_info) {
        throw new NotFoundException('Service provider profile not found. Please complete your profile first.');
      }

      const existingBrandLogoUrl = user.service_provider_info.brand_logo_url;

      // Upload brand logo file if provided
      let brandLogoFileName: string | undefined = undefined;
      if (brandLogoFile) {
        // Delete old brand logo if exists
        if (existingBrandLogoUrl) {
          try {
            await SojebStorage.delete(appConfig().storageUrl.brand + existingBrandLogoUrl);
          } catch (error) {
            // Continue even if deletion fails
            console.error('Failed to delete old brand logo:', error);
          }
        }
        // Upload new brand logo
        brandLogoFileName = `${StringHelper.randomString()}${brandLogoFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.brand + brandLogoFileName,
          brandLogoFile.buffer,
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

      if (updateData.facility_name !== undefined) {
        updatePayload.facility_name = updateData.facility_name;
      }

      if (updateData.mobile_code !== undefined) {
        updatePayload.mobile_code = updateData.mobile_code;
      }

      if (updateData.mobile_number !== undefined) {
        updatePayload.mobile_number = updateData.mobile_number;
      }

      if (brandLogoFileName !== undefined) {
        updatePayload.brand_logo_url = brandLogoFileName;
      }

      // Update service provider profile
      const updatedProfile = await this.prisma.serviceProviderInfo.update({
        where: { user_id: userId },
        data: updatePayload,
        select: {
          id: true,
          user_id: true,
          first_name: true,
          last_name: true,
          facility_name: true,
          organization_name: true,
          mobile_code: true,
          mobile_number: true,
          brand_logo_url: true,
          updated_at: true,
        },
      });

      // Format brand logo URL if exists
      let formattedBrandLogoUrl: string | null = null;
      if (updatedProfile.brand_logo_url) {
        formattedBrandLogoUrl = SojebStorage.url(
          appConfig().storageUrl.brand + updatedProfile.brand_logo_url,
        );
      }

      return {
        success: true,
        message: 'Service provider profile updated successfully',
        data: {
          ...updatedProfile,
          brand_logo_url: formattedBrandLogoUrl,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update service provider profile: ${error.message}`);
    }
  }

  /**
   * Update service provider business info
   * @param userId - The user ID from the authenticated request
   * @param updateData - The data to update
   * @param supportDocumentsFile - Optional file for support documents
   */
  async updateBusinessInfo(
    userId: string,
    updateData: UpdateBusinessInfoDto,
    supportDocumentsFile?: Express.Multer.File,
  ) {
    try {
      // Verify user exists and get service provider profile
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          service_provider_info: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.type !== 'service_provider') {
        throw new BadRequestException('User is not a service provider');
      }

      if (!user.service_provider_info) {
        throw new NotFoundException('Service provider profile not found. Please complete your profile first.');
      }

      const existingSupportDocumentsUrl = (user.service_provider_info as any).support_documents_url;

      // Upload support documents file if provided
      let supportDocumentsFileName: string | undefined = undefined;
      if (supportDocumentsFile) {
        // Delete old support documents file if exists
        if (existingSupportDocumentsUrl) {
          try {
            await SojebStorage.delete(appConfig().storageUrl.certificate + existingSupportDocumentsUrl);
          } catch (error) {
            // Continue even if deletion fails
            console.error('Failed to delete old support documents file:', error);
          }
        }
        // Upload new support documents file
        supportDocumentsFileName = `${StringHelper.randomString()}${supportDocumentsFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.certificate + supportDocumentsFileName,
          supportDocumentsFile.buffer,
        );
      }

      // Prepare update data
      const updatePayload: any = {};

      if (updateData.organization_name !== undefined) {
        updatePayload.organization_name = updateData.organization_name;
      }

      if (updateData.website !== undefined) {
        updatePayload.website = updateData.website;
      }

      if (updateData.cqc_provider_number !== undefined) {
        updatePayload.cqc_provider_number = updateData.cqc_provider_number;
      }

      if (updateData.vat_tax_id !== undefined) {
        updatePayload.vat_tax_id = updateData.vat_tax_id;
      }

      if (updateData.primary_address !== undefined) {
        updatePayload.primary_address = updateData.primary_address;
      }

      if (updateData.main_service_type !== undefined) {
        updatePayload.main_service_type = updateData.main_service_type;
      }

      if (updateData.max_client_capacity !== undefined) {
        updatePayload.max_client_capacity = updateData.max_client_capacity;
      }

      if (supportDocumentsFileName !== undefined) {
        updatePayload.support_documents_url = supportDocumentsFileName;
      }

      // Update service provider business info
      const updatedProfile = await this.prisma.serviceProviderInfo.update({
        where: { user_id: userId },
        data: updatePayload,
        select: {
          id: true,
          user_id: true,
          organization_name: true,
          website: true,
          cqc_provider_number: true,
          vat_tax_id: true,
          primary_address: true,
          main_service_type: true,
          max_client_capacity: true,
          support_documents_url: true,
          updated_at: true,
        },
      });

      // Format support documents URL if exists
      let formattedSupportDocumentsUrl: string | null = null;
      if (updatedProfile.support_documents_url) {
        formattedSupportDocumentsUrl = SojebStorage.url(
          appConfig().storageUrl.certificate + updatedProfile.support_documents_url,
        );
      }

      return {
        success: true,
        message: 'Business info updated successfully',
        data: {
          ...updatedProfile,
          support_documents_url: formattedSupportDocumentsUrl,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update business info: ${error.message}`);
    }
  }

  /**
   * Get service provider profile with all related data
   * @param userId - The user ID from the authenticated request
   */
  async getServiceProviderProfile(userId: string) {
    try {
      // Verify user exists and get service provider profile
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          service_provider_info: {
            include: {
              employees: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  mobile_code: true,
                  mobile_number: true,
                  employee_role: true,
                  is_active: true,
                  created_at: true,
                  updated_at: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.type !== 'service_provider') {
        throw new BadRequestException('User is not a service provider');
      }

      if (!user.service_provider_info) {
        throw new NotFoundException('Service provider profile not found. Please complete your profile first.');
      }

      const profile = user.service_provider_info;

      // Format brand logo URL if exists
      if (profile.brand_logo_url) {
        profile.brand_logo_url = SojebStorage.url(
          appConfig().storageUrl.brand + profile.brand_logo_url,
        );
      }

      // Format support documents URL if exists
      if ((profile as any).support_documents_url) {
        (profile as any).support_documents_url = SojebStorage.url(
          appConfig().storageUrl.certificate + (profile as any).support_documents_url,
        );
      }

      // Include user info (without sensitive data)
      const userInfo = {
        id: user.id,
        email: user.email,
        status: user.status,
        approved_at: user.approved_at,
        email_verified_at: user.email_verified_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };

      return {
        success: true,
        message: 'Service provider profile fetched successfully',
        data: {
          ...profile,
          user: userInfo,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch service provider profile: ${error.message}`);
    }
  }
}
