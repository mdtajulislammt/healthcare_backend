import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  CertificateVerificationStatus,
  Prisma,
  CertificateType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { calculateStaffProfileCompletion } from 'src/common/helper/profile-completion.helper';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffCertificateDto } from './dto/update-staff-certificate.dto';
import { MailService } from 'src/mail/mail.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import { DateHelper } from 'src/common/helper/date.helper';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private async recalculateProfileCompletion(staff_id: string) {
    const staffProfileWithRelations = await this.prisma.staffProfile.findUnique(
      {
        where: { id: staff_id },
        include: {
          certificates: true,
          dbs_info: true,
          emergency_contacts: true,
          current_address: true,
          previous_address: true,
          referees: true,
          educations: true,
          bank_details: true,
        },
      },
    );

    if (staffProfileWithRelations) {
      const completionResult = calculateStaffProfileCompletion(
        staffProfileWithRelations,
      );

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

  async create(
    createStaffDto: CreateStaffDto,
    files?: {
      photo?: Express.Multer.File[];
      cv?: Express.Multer.File[];
      care_certificate?: Express.Multer.File[];
      moving_handling?: Express.Multer.File[];
      first_aid?: Express.Multer.File[];
      basic_life_support?: Express.Multer.File[];
      infection_control?: Express.Multer.File[];
      safeguarding?: Express.Multer.File[];
      health_safety?: Express.Multer.File[];
      equality_diversity?: Express.Multer.File[];
      coshh?: Express.Multer.File[];
      medication_training?: Express.Multer.File[];
      nvq_iii?: Express.Multer.File[];
      additional_training?: Express.Multer.File[];
    },
  ) {
    try {
      const email = String(createStaffDto.email ?? '')
        .trim()
        .toLowerCase();
      const password = String(createStaffDto.password ?? '').trim();

      if (!email) {
        throw new BadRequestException('Email is required');
      }

      if (!password) {
        throw new BadRequestException('Password is required');
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, deleted_at: true },
      });

      if (existingUser) {
        if (existingUser.deleted_at !== null) {
          await this.prisma.user.delete({
            where: { id: existingUser.id },
          });
        } else {
          throw new BadRequestException('Email already exists');
        }
      }

      const photo = files?.photo?.[0];
      const cv = files?.cv?.[0];

      const certificateFiles: { [key: string]: Express.Multer.File[] } = {};
      if (files) {
        const certFields = [
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

        for (const field of certFields) {
          if (files[field]) {
            certificateFiles[field] = files[field];
          }
        }
      }

      let staffPhotoFileName: string = null;
      if (photo) {
        staffPhotoFileName = `${StringHelper.randomString()}${photo.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.staff + staffPhotoFileName,
          photo.buffer,
        );
      }

      let staffCvFileName: string = null;
      if (cv) {
        staffCvFileName = `${StringHelper.randomString()}${cv.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.cv + staffCvFileName,
          cv.buffer,
        );
      }

      const typeToFile: Record<string, Express.Multer.File> = {};
      const certificateFileNames: Record<string, string> = {};

      if (Object.keys(certificateFiles).length > 0) {
        const allowedTypesSet = new Set([
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
        ]);

        for (const [fieldName, fileArray] of Object.entries(certificateFiles)) {
          const type = fieldName.trim().toLowerCase();
          if (!allowedTypesSet.has(type)) continue;
          if (!fileArray || fileArray.length === 0) continue;
          if (typeToFile[type]) continue;
          typeToFile[type] = fileArray[0];
        }

        for (const [type, file] of Object.entries(typeToFile)) {
          const fileName = `${StringHelper.randomString()}${file.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.certificate + fileName,
            file.buffer,
          );
          certificateFileNames[type] = fileName;
        }
      }

      // parse optional certificate expiries provided by admin as JSON
      const certificateExpiries: Record<string, Date | undefined> = {};
      if (createStaffDto.certificate_expiries) {
        try {
          const parsed =
            typeof createStaffDto.certificate_expiries === 'string'
              ? JSON.parse(createStaffDto.certificate_expiries)
              : createStaffDto.certificate_expiries;
          if (parsed && typeof parsed === 'object') {
            for (const [k, v] of Object.entries(parsed)) {
              if (!v) continue;
              const d = new Date(String(v));
              if (!isNaN(d.getTime())) certificateExpiries[k.toLowerCase()] = d;
            }
          }
        } catch (err) {
          // ignore parse errors
        }
      }

      const rolesNormalized = Array.isArray(createStaffDto.roles)
        ? createStaffDto.roles
        : typeof createStaffDto.roles === 'string'
          ? String(createStaffDto.roles)
              .split(',')
              .map((value: string) => value.trim().toLowerCase())
              .filter(Boolean)
          : undefined;

      const mainDobDate = DateHelper.parseFlexibleDate(
        createStaffDto.date_of_birth,
      );
      if (!mainDobDate) {
        throw new BadRequestException(
          'date_of_birth is required and must be a valid date in YYYY-MM-DD or DD/MM/YYYY format.',
        );
      }

      const agreedStaff =
        typeof createStaffDto.agreed_to_terms === 'string'
          ? ['true', '1', 'yes'].includes(
              String(createStaffDto.agreed_to_terms).trim().toLowerCase(),
            )
          : !!createStaffDto.agreed_to_terms;

      let dbsData = null;
      if (
        createStaffDto.dbs_certificate_number &&
        createStaffDto.dbs_surname_as_certificate &&
        createStaffDto.dbs_date_of_birth_on_cert &&
        createStaffDto.dbs_certificate_print_date
      ) {
        const dobDate = DateHelper.parseFlexibleDate(
          String(createStaffDto.dbs_date_of_birth_on_cert).trim(),
        );
        const printDate = DateHelper.parseFlexibleDate(
          String(createStaffDto.dbs_certificate_print_date).trim(),
        );

        if (!dobDate || !printDate) {
          throw new BadRequestException(
            'Invalid DBS date format. Please use YYYY-MM-DD or DD/MM/YYYY.',
          );
        }

        dbsData = {
          certificate_number: createStaffDto.dbs_certificate_number,
          surname_as_certificate: createStaffDto.dbs_surname_as_certificate,
          date_of_birth_on_cert: dobDate,
          certificate_print_date: printDate,
          is_registered_on_update:
            typeof createStaffDto.dbs_is_registered_on_update === 'string'
              ? ['true', '1', 'yes'].includes(
                  createStaffDto.dbs_is_registered_on_update
                    .trim()
                    .toLowerCase(),
                )
              : !!createStaffDto.dbs_is_registered_on_update,
        };
      }

      let refereesSource: any[] = [];
      if (Array.isArray(createStaffDto.referees)) {
        refereesSource = createStaffDto.referees;
      }

      const normalizeConsent = (value: unknown): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') {
          return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
        }
        return false;
      };

      const refereesData: any[] = [];
      for (const referee of refereesSource) {
        if (!referee) continue;

        const name = String(referee.name ?? '').trim();
        const mobileCode = String(referee.mobile_code ?? '').trim();
        const mobileNumber = String(referee.mobile_number ?? '').trim();
        const emailValue = referee.email ? String(referee.email).trim() : '';
        const role = referee.role ? String(referee.role).trim() : undefined;

        if (!name || !emailValue) {
          throw new BadRequestException(
            'Each referee must include name and email.',
          );
        }

        const refereeData: any = {
          name,
          mobile_code: mobileCode,
          mobile_number: mobileNumber,
          email: emailValue,
          role,
          consent_to_contact: normalizeConsent(referee.consent_to_contact),
        };

        if (referee.start_date) {
          const startDate = DateHelper.parseFlexibleDate(String(referee.start_date).trim());
          if (!startDate) {
            throw new BadRequestException('Invalid referee start_date format. Please use YYYY-MM-DD or DD/MM/YYYY.');
          }
          refereeData.start_date = startDate;
        }

        if (referee.end_date) {
          const endDate = DateHelper.parseFlexibleDate(String(referee.end_date).trim());
          if (!endDate) {
            throw new BadRequestException('Invalid referee end_date format. Please use YYYY-MM-DD or DD/MM/YYYY.');
          }
          refereeData.end_date = endDate;
        }

        refereesData.push(refereeData);
      }

      const staffRole = await this.prisma.role.findFirst({
        where: { name: 'staff' },
      });

      const result = await this.prisma.$transaction(async (tx) => {
        const hashedPassword = await bcrypt.hash(
          password,
          appConfig().security.salt,
        );

        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            type: 'staff',
            status: 1,
            approved_at: new Date(),
            email_verified_at: new Date(),
            onboarding_step: 'completed',
          },
        });

        if (staffRole) {
          await tx.roleUser.create({
            data: {
              user_id: user.id,
              role_id: staffRole.id,
            },
          });
        }

        const staffProfile = await tx.staffProfile.create({
          data: {
            user_id: user.id,
            first_name: createStaffDto.first_name,
            last_name: createStaffDto.last_name,
            mobile_code: createStaffDto.mobile_code,
            mobile_number: createStaffDto.mobile_number,
            date_of_birth: mainDobDate,
            roles:
              rolesNormalized && rolesNormalized.length > 0
                ? (rolesNormalized as any)
                : undefined,
            right_to_work_status: createStaffDto.right_to_work_status,
            cv_url: staffCvFileName ?? undefined,
            photo_url: staffPhotoFileName ?? undefined,
            agreed_to_terms: agreedStaff ?? true,
            experience: createStaffDto.experience,
            nmc_pin: createStaffDto.nmc_pin,
            gender: createStaffDto.gender,
            age: createStaffDto.age,
            can_apply_to_shifts: createStaffDto.can_apply_to_shifts ?? true,
          },
        });

        const certificatesCreated = [];
        for (const [type, fileName] of Object.entries(certificateFileNames)) {
          const expiryDate =
            certificateExpiries[type] ??
            certificateExpiries[type.toLowerCase()];
          const cert = await tx.staffCertificate.create({
            data: {
              staff_id: staffProfile.id,
              certificate_type: type as any,
              file_url: fileName,
              expiry_date: expiryDate ?? undefined,
            },
          });
          certificatesCreated.push(cert);
        }

        let dbsInfo = null;
        if (dbsData) {
          dbsInfo = await tx.staffDbsInfo.create({
            data: {
              staff_id: staffProfile.id,
              ...dbsData,
            },
          });
        }

        const refereesCreated = [];
        if (refereesData.length > 0) {
          const created = await tx.staffReferee.createMany({
            data: refereesData.map((referee) => ({
              staff_id: staffProfile.id,
              ...referee,
            })),
          });
          refereesCreated.push(created);
        }

        return {
          user,
          staffProfile,
          certificatesCreated,
          dbsInfo,
          refereesCreated,
        };
      });

      const staffProfileWithRelations =
        await this.prisma.staffProfile.findUnique({
          where: { id: result.staffProfile.id },
          include: {
            certificates: true,
            dbs_info: true,
            emergency_contacts: true,
            current_address: true,
            previous_address: true,
            educations: true,
            referees: true,
            bank_details: true,
          },
        });

      if (staffProfileWithRelations) {
        const completionResult = calculateStaffProfileCompletion(
          staffProfileWithRelations,
        );

        await this.prisma.staffProfile.update({
          where: { id: result.staffProfile.id },
          data: {
            profile_completion: completionResult.profile_completion,
            is_profile_complete: completionResult.is_profile_complete,
          },
        });
      }

      // Send email notification to info@vitalhands.co.uk
      try {
        await this.mailService.sendNewStaffNotification({
          staffName: `${result.staffProfile.first_name} ${result.staffProfile.last_name}`,
          staffEmail: result.user.email,
          roles: result.staffProfile.roles,
        });
      } catch (mailError) {
        console.error(
          'Failed to send new staff email notification:',
          mailError,
        );
      }

      // Send login credentials to the newly created staff member
      try {
        await this.mailService.sendUserCredentials({
          email: result.user.email,
          name: `${result.staffProfile.first_name} ${result.staffProfile.last_name}`,
          password: password,
          accountType: 'staff',
        });
      } catch (mailError) {
        console.error('Failed to send staff credentials email:', mailError);
      }

      return {
        success: true,
        message: 'Staff user and profile created successfully',
        data: {
          user_id: result.user.id,
          staff_profile_id: result.staffProfile.id,
          certificates_created: result.certificatesCreated.length,
          dbs_info_created: !!result.dbsInfo,
          referees_created: refereesData.length,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create staff');
    }
  }

  async findAll({
    page = 1,
    limit = 10,
    search = '',
    status,
    right_to_work_status,
    roles,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    right_to_work_status?: string;
    roles?: string;
  } = {}) {
    try {
      const currentPage = Math.max(Number(page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
      if (Number.isNaN(currentPage) || Number.isNaN(pageSize)) {
        throw new BadRequestException('Invalid pagination parameters');
      }
      const skip = (currentPage - 1) * pageSize;

      // Build where clause
      const andConditions: any[] = [];

      // Search filter
      if (search) {
        andConditions.push({
          OR: [
            {
              first_name: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
            {
              last_name: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
            {
              user: {
                email: {
                  contains: search,
                  mode: 'insensitive' as Prisma.QueryMode,
                },
              },
            },
          ],
        });
      }

      // Exclude soft-deleted users by default
      andConditions.push({ user: { deleted_at: null } });

      // Status filter (0=pending, 1=active, 2=suspended)
      if (status) {
        const statusValue = status.toLowerCase().trim();
        let userStatus: number | undefined;

        if (statusValue === 'pending' || statusValue === '0') {
          userStatus = 0;
        } else if (statusValue === 'active' || statusValue === '1') {
          userStatus = 1;
        } else if (statusValue === 'suspended' || statusValue === '2') {
          userStatus = 2;
        }

        if (userStatus !== undefined) {
          andConditions.push({ user: { status: userStatus } });
        }
      }

      // Right to work status filter (enum field - exact match)
      if (right_to_work_status) {
        const rtw = right_to_work_status.trim();
        andConditions.push({ right_to_work_status: rtw });
      }

      // Roles filter (can be comma-separated for multiple roles)
      if (roles) {
        const roleList = roles
          .split(',')
          .map((r) => r.trim())
          .filter((r) => r.length > 0);
        if (roleList.length > 0) {
          andConditions.push({
            OR: roleList.map((role) => ({
              roles: { has: role },
            })),
          });
        }
      }

      const where =
        andConditions.length > 0 ? { AND: andConditions } : undefined;

      const [total, staff] = await this.prisma.$transaction([
        this.prisma.staffProfile.count({ where }),
        this.prisma.staffProfile.findMany({
          where,
          select: {
            id: true,
            user_id: true,
            first_name: true,
            last_name: true,
            mobile_code: true,
            mobile_number: true,
            date_of_birth: true,
            photo_url: true,
            cv_url: true,
            roles: true,
            right_to_work_status: true,
            created_at: true,
            updated_at: true,
            dbs_info: {
              select: {
                id: true,
                certificate_number: true,
                created_at: true,
                updated_at: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
                status: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      for (const s of staff) {
        if (s.photo_url) {
          s.photo_url = SojebStorage.url(
            appConfig().storageUrl.staff + s.photo_url,
          );
        }
        if (s.cv_url) {
          s.cv_url = SojebStorage.url(appConfig().storageUrl.cv + s.cv_url);
        }
      }

      return {
        success: true,
        message: 'Staff list fetched successfully',
        data: staff,
        meta: {
          total,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to fetch staff list');
    }
  }

  async findOne(id: string) {
    try {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              status: true,
              deleted_at: true,
              approved_at: true,
              email_verified_at: true,
              created_at: true,
              updated_at: true,
            },
          },
          certificates: {
            select: {
              id: true,
              certificate_type: true,
              file_url: true,
              uploaded_at: true,
              verified_status: true,
              expiry_date: true,
              expiry_notified_at: true,
            },
            orderBy: { uploaded_at: 'desc' },
          },
          dbs_info: true,
          referees: true,
          reviews: true,
        },
      });

      if (!staff) throw new NotFoundException('Staff not found');

      if (staff.user?.deleted_at) {
        throw new NotFoundException('Staff not found');
      }

      if (staff.photo_url) {
        staff.photo_url = SojebStorage.url(
          appConfig().storageUrl.staff + staff.photo_url,
        );
      }
      if (staff.cv_url) {
        staff.cv_url = SojebStorage.url(
          appConfig().storageUrl.cv + staff.cv_url,
        );
      }
      if (staff.certificates && staff.certificates.length) {
        for (const c of staff.certificates) {
          if (c.file_url) {
            c.file_url = SojebStorage.url(
              appConfig().storageUrl.certificate + c.file_url,
            );
          }
        }
      }

      // Calculate average rating
      const reviews = await this.prisma.staffPerformanceReview.findMany({
        where: { staff_id: id },
        select: { rating: true },
      });
      const avgRating =
        reviews.length > 0
          ? (
              reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            ).toFixed(2)
          : 0;

      // Calculate max hours per week
      const timesheets = await this.prisma.shiftTimesheet.findMany({
        where: { staff_id: id },
        select: { total_hours: true, shift: { select: { start_date: true } } },
      });

      let maxHoursPerWeek = 0;
      if (timesheets.length > 0) {
        const hoursPerWeek = new Map<string, number>();
        for (const ts of timesheets) {
          if (ts.total_hours && ts.shift?.start_date) {
            const weekNumber = Math.ceil(ts.shift.start_date.getDate() / 7);
            const yearWeek = `${ts.shift.start_date.getFullYear()}-W${weekNumber}`;
            hoursPerWeek.set(
              yearWeek,
              (hoursPerWeek.get(yearWeek) || 0) + ts.total_hours,
            );
          }
        }
        maxHoursPerWeek = Math.max(...Array.from(hoursPerWeek.values()));
      }

      return {
        success: true,
        message: 'Staff fetched successfully',
        data: {
          ...staff,
          avgRating: Number(avgRating),
          maxHoursPerWeek,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch staff');
    }
  }

  async update(
    id: string,
    updateStaffDto: UpdateStaffDto,
    photoFile?: Express.Multer.File,
    cvFile?: Express.Multer.File,
    currentAddressEvidenceFile?: Express.Multer.File,
  ) {
    try {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { id },
        include: {
          user: true,
          current_address: true,
        },
      });

      if (!staff) {
        throw new NotFoundException('Staff not found');
      }

      const existingPhotoUrl = staff.photo_url;
      const existingCvUrl = staff.cv_url;
      const existingCurrentAddress = staff.current_address;

      const existingUserEmail = staff.user.email;

      let staffPhotoFileName: string | undefined = undefined;
      if (photoFile) {
        if (existingPhotoUrl) {
          try {
            await SojebStorage.delete(
              appConfig().storageUrl.staff + existingPhotoUrl,
            );
          } catch (error) {
            console.error('Failed to delete old photo:', error);
          }
        }

        staffPhotoFileName = `${StringHelper.randomString()}${photoFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.staff + staffPhotoFileName,
          photoFile.buffer,
        );
      }

      let staffCvFileName: string | undefined = undefined;
      if (cvFile) {
        if (existingCvUrl) {
          try {
            await SojebStorage.delete(
              appConfig().storageUrl.cv + existingCvUrl,
            );
          } catch (error) {
            console.error('Failed to delete old CV:', error);
          }
        }

        staffCvFileName = `${StringHelper.randomString()}${cvFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.cv + staffCvFileName,
          cvFile.buffer,
        );
      }

      let currentAddressEvidenceFileName: string | undefined = undefined;
      if (currentAddressEvidenceFile) {
        if (existingCurrentAddress?.evidence_file_url) {
          try {
            await SojebStorage.delete(
              appConfig().storageUrl.certificate +
                existingCurrentAddress.evidence_file_url,
            );
          } catch (error) {
            console.error(
              'Failed to delete old current address evidence:',
              error,
            );
          }
        }

        currentAddressEvidenceFileName = `${StringHelper.randomString()}${currentAddressEvidenceFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.certificate + currentAddressEvidenceFileName,
          currentAddressEvidenceFile.buffer,
        );
      }

      const updatePayload: any = {};

      if (updateStaffDto.first_name !== undefined) {
        updatePayload.first_name = updateStaffDto.first_name;
      }

      if (updateStaffDto.last_name !== undefined) {
        updatePayload.last_name = updateStaffDto.last_name;
      }

      if (updateStaffDto.mobile_code !== undefined) {
        updatePayload.mobile_code = updateStaffDto.mobile_code;
      }

      if (updateStaffDto.mobile_number !== undefined) {
        updatePayload.mobile_number = updateStaffDto.mobile_number;
      }

      if (updateStaffDto.date_of_birth !== undefined) {
        const dobDate = DateHelper.parseFlexibleDate(
          updateStaffDto.date_of_birth,
        );
        if (!dobDate) {
          throw new BadRequestException(
            'Invalid date_of_birth format. Please use YYYY-MM-DD or DD/MM/YYYY.',
          );
        }
        updatePayload.date_of_birth = dobDate;
      }

      if (updateStaffDto.experience !== undefined) {
        updatePayload.experience = updateStaffDto.experience;
      }

      if (updateStaffDto.bio !== undefined) {
        updatePayload.bio = updateStaffDto.bio;
      }

      if (updateStaffDto.right_to_work_status !== undefined) {
        updatePayload.right_to_work_status =
          updateStaffDto.right_to_work_status;
      }

      if (updateStaffDto.nmc_pin !== undefined) {
        updatePayload.nmc_pin = updateStaffDto.nmc_pin;
      }

      if (updateStaffDto.agreed_to_terms !== undefined) {
        updatePayload.agreed_to_terms = updateStaffDto.agreed_to_terms;
      }

      if (updateStaffDto.gender !== undefined) {
        updatePayload.gender = updateStaffDto.gender;
      }

      if (updateStaffDto.age !== undefined) {
        updatePayload.age = updateStaffDto.age;
      }

      if (updateStaffDto.can_apply_to_shifts !== undefined) {
        updatePayload.can_apply_to_shifts = updateStaffDto.can_apply_to_shifts;
      }

      if (staffPhotoFileName !== undefined) {
        updatePayload.photo_url = staffPhotoFileName;
      }

      if (staffCvFileName !== undefined) {
        updatePayload.cv_url = staffCvFileName;
      }

      if (updateStaffDto.roles !== undefined) {
        const rolesArray = Array.isArray(updateStaffDto.roles)
          ? updateStaffDto.roles
          : [];
        const allowedRoles = [
          'nurse',
          'senior_hca',
          'hca_carer',
          'support_worker',
        ];
        updatePayload.roles = rolesArray.filter((role: string) =>
          allowedRoles.includes(role),
        ) as any;
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // if (
        //   updateStaffDto.email !== undefined &&
        //   updateStaffDto.email.trim().toLowerCase() !==
        //     existingUserEmail?.toLowerCase()
        // ) {
        //   const emailExists = await tx.user.findUnique({
        //     where: { email: updateStaffDto.email.trim().toLowerCase() },
        //     select: { id: true },
        //   });

        //   if (emailExists && emailExists.id !== staff.user_id) {
        //     throw new BadRequestException('Email already exists');
        //   }

        //   await tx.user.update({
        //     where: { id: staff.user_id },
        //     data: { email: updateStaffDto.email.trim().toLowerCase() },
        //   });
        // }

        if (updateStaffDto.password !== undefined) {
          const hashedPassword = await bcrypt.hash(
            updateStaffDto.password,
            appConfig().security.salt,
          );

          await tx.user.update({
            where: { id: staff.user_id },
            data: { password: hashedPassword },
          });
        }

        const updatedProfile = await tx.staffProfile.update({
          where: { id },
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
            right_to_work_status: true,
            experience: true,
            bio: true,
            photo_url: true,
            cv_url: true,
            updated_at: true,
          },
        });

        let emergencyContact = null;
        if (updateStaffDto.emergency_contact) {
          const emergencyData = updateStaffDto.emergency_contact;

          if (
            emergencyData.mobile_code === undefined ||
            emergencyData.mobile_number === undefined
          ) {
            throw new BadRequestException(
              'Emergency contact mobile_code and mobile_number are required',
            );
          }

          emergencyContact = await tx.staffEmergencyContact.upsert({
            where: { staff_id: id },
            update: {
              name: emergencyData.name ?? undefined,
              mobile_code: emergencyData.mobile_code,
              mobile_number: emergencyData.mobile_number,
              relationship: emergencyData.relationship ?? undefined,
            },
            create: {
              staff_id: id,
              name: emergencyData.name ?? null,
              mobile_code: emergencyData.mobile_code,
              mobile_number: emergencyData.mobile_number,
              relationship: emergencyData.relationship ?? null,
            },
          });
        }

        let currentAddress = null;
        if (updateStaffDto.current_address) {
          const addressData = updateStaffDto.current_address;

          if (addressData.address === undefined) {
            throw new BadRequestException('Current address is required');
          }

          const currentAddressUpdateData: any = {
            address: addressData.address,
            city: addressData.city ?? undefined,
            state: addressData.state ?? undefined,
            zip: addressData.zip ?? undefined,
            country: addressData.country ?? undefined,
            from_date: addressData.from_date
              ? new Date(addressData.from_date)
              : undefined,
            to_date: addressData.to_date
              ? new Date(addressData.to_date)
              : undefined,
          };

          if (currentAddressEvidenceFileName !== undefined) {
            currentAddressUpdateData.evidence_file_url =
              currentAddressEvidenceFileName;
          }

          currentAddress = await tx.staffCurrentAddress.upsert({
            where: { staff_id: id },
            update: currentAddressUpdateData,
            create: {
              staff_id: id,
              address: addressData.address,
              city: addressData.city ?? null,
              state: addressData.state ?? null,
              zip: addressData.zip ?? null,
              country: addressData.country ?? null,
              from_date: addressData.from_date
                ? new Date(addressData.from_date)
                : null,
              to_date: addressData.to_date
                ? new Date(addressData.to_date)
                : null,
              evidence_file_url: currentAddressEvidenceFileName ?? null,
            },
          });
        } else if (currentAddressEvidenceFile) {
          if (existingCurrentAddress) {
            currentAddress = await tx.staffCurrentAddress.update({
              where: { staff_id: id },
              data: {
                evidence_file_url: currentAddressEvidenceFileName,
              },
            });
          } else {
            throw new BadRequestException(
              'Current address must be provided before uploading evidence file',
            );
          }
        }

        let previousAddress = null;
        if (updateStaffDto.previous_address) {
          const addressData = updateStaffDto.previous_address;

          if (addressData.address === undefined) {
            throw new BadRequestException('Previous address is required');
          }

          previousAddress = await tx.staffPreviousAddress.upsert({
            where: { staff_id: id },
            update: {
              address: addressData.address,
              city: addressData.city ?? undefined,
              state: addressData.state ?? undefined,
              zip: addressData.zip ?? undefined,
              country: addressData.country ?? undefined,
              from_date: addressData.from_date
                ? new Date(addressData.from_date)
                : undefined,
              to_date: addressData.to_date
                ? new Date(addressData.to_date)
                : undefined,
            },
            create: {
              staff_id: id,
              address: addressData.address,
              city: addressData.city ?? null,
              state: addressData.state ?? null,
              zip: addressData.zip ?? null,
              country: addressData.country ?? null,
              from_date: addressData.from_date
                ? new Date(addressData.from_date)
                : null,
              to_date: addressData.to_date
                ? new Date(addressData.to_date)
                : null,
            },
          });
        }

        let dbsInfo = null;
        if (
          updateStaffDto.dbs_certificate_number ||
          updateStaffDto.dbs_surname_as_certificate ||
          updateStaffDto.dbs_date_of_birth_on_cert ||
          updateStaffDto.dbs_certificate_print_date ||
          updateStaffDto.dbs_is_registered_on_update !== undefined
        ) {
          const dbsUpdateData: any = {};

          if (updateStaffDto.dbs_certificate_number !== undefined) {
            dbsUpdateData.certificate_number =
              updateStaffDto.dbs_certificate_number;
          }

          if (updateStaffDto.dbs_surname_as_certificate !== undefined) {
            dbsUpdateData.surname_as_certificate =
              updateStaffDto.dbs_surname_as_certificate;
          }

          if (updateStaffDto.dbs_date_of_birth_on_cert !== undefined) {
            const dobDate = DateHelper.parseFlexibleDate(
              updateStaffDto.dbs_date_of_birth_on_cert,
            );
            if (!dobDate) {
              throw new BadRequestException(
                'Invalid DBS date value. Please use YYYY-MM-DD or DD/MM/YYYY.',
              );
            }
            dbsUpdateData.date_of_birth_on_cert = dobDate;
          }

          if (updateStaffDto.dbs_certificate_print_date !== undefined) {
            const printDate = DateHelper.parseFlexibleDate(
              updateStaffDto.dbs_certificate_print_date,
            );
            if (!printDate) {
              throw new BadRequestException(
                'Invalid DBS date value. Please use YYYY-MM-DD or DD/MM/YYYY.',
              );
            }
            dbsUpdateData.certificate_print_date = printDate;
          }

          if (updateStaffDto.dbs_is_registered_on_update !== undefined) {
            dbsUpdateData.is_registered_on_update =
              typeof updateStaffDto.dbs_is_registered_on_update === 'string'
                ? ['true', '1', 'yes'].includes(
                    updateStaffDto.dbs_is_registered_on_update
                      .trim()
                      .toLowerCase(),
                  )
                : !!updateStaffDto.dbs_is_registered_on_update;
          }

          const existingDbsInfo = await tx.staffDbsInfo.findUnique({
            where: { staff_id: id },
          });

          if (existingDbsInfo) {
            dbsInfo = await tx.staffDbsInfo.update({
              where: { staff_id: id },
              data: dbsUpdateData,
            });
          } else {
            dbsInfo = await tx.staffDbsInfo.create({
              data: {
                staff_id: id,
                ...dbsUpdateData,
              },
            });
          }
        }

        let refereesSource: any[] = [];
        if (Array.isArray(updateStaffDto.referees)) {
          refereesSource = updateStaffDto.referees;
        } else if (typeof updateStaffDto.referees === 'string') {
          try {
            const parsed = JSON.parse(updateStaffDto.referees);
            refereesSource = Array.isArray(parsed) ? parsed : [];
          } catch {
            throw new BadRequestException(
              'Invalid JSON format for referees field. Please send a valid JSON array.',
            );
          }
        }

        const referees: any[] = [];
        for (const refereeData of refereesSource) {
          const updateRefereePayload: any = {};

          if (refereeData.name !== undefined) {
            updateRefereePayload.name = refereeData.name;
          }
          if (refereeData.mobile_code !== undefined) {
            updateRefereePayload.mobile_code = refereeData.mobile_code;
          }
          if (refereeData.mobile_number !== undefined) {
            updateRefereePayload.mobile_number = refereeData.mobile_number;
          }
          if (refereeData.email !== undefined) {
            updateRefereePayload.email = refereeData.email;
          }
          if (refereeData.role !== undefined) {
            updateRefereePayload.role = refereeData.role;
          }
          if (refereeData.consent_to_contact !== undefined) {
            updateRefereePayload.consent_to_contact =
              typeof refereeData.consent_to_contact === 'boolean'
                ? refereeData.consent_to_contact
                : typeof refereeData.consent_to_contact === 'number'
                  ? refereeData.consent_to_contact === 1
                  : ['true', '1', 'yes'].includes(
                      String(refereeData.consent_to_contact)
                        .trim()
                        .toLowerCase(),
                    );
          }
          if (refereeData.start_date !== undefined) {
            updateRefereePayload.start_date = new Date(refereeData.start_date);
          }
          if (refereeData.end_date !== undefined) {
            updateRefereePayload.end_date = new Date(refereeData.end_date);
          }

          if (Object.keys(updateRefereePayload).length === 0) {
            if (refereeData?.id) {
              throw new BadRequestException(
                `No update fields provided for referee id "${refereeData.id}"`,
              );
            }
            continue;
          }

          if (!refereeData?.id) {
            if (!updateRefereePayload.name) {
              throw new BadRequestException(
                'Referee name is required when creating a new referee',
              );
            }

            const createdReferee = await tx.staffReferee.create({
              data: {
                ...updateRefereePayload,
                staff_id: id,
              },
            });

            referees.push(createdReferee);
            continue;
          }

          const existingReferee = await tx.staffReferee.findFirst({
            where: {
              id: refereeData.id,
              staff_id: id,
            },
          });

          if (!existingReferee) {
            continue;
          }

          const updatedReferee = await tx.staffReferee.update({
            where: { id: refereeData.id },
            data: updateRefereePayload,
          });

          referees.push(updatedReferee);
        }

        return {
          profile: updatedProfile,
          emergencyContact,
          currentAddress,
          previousAddress,
          dbsInfo,
          referees,
        };
      });

      await this.recalculateProfileCompletion(id);

      const finalProfile = await this.prisma.staffProfile.findUnique({
        where: { id },
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
          right_to_work_status: true,
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
          dbs_info: result.dbsInfo,
          referees: result.referees,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to update staff profile: ${errorMessage}`,
      );
    }
  }

  async remove(id: string) {
    try {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { id },
        select: {
          id: true,
          user_id: true,
        },
      });

      if (!staff) {
        throw new NotFoundException('Staff not found');
      }

      await this.prisma.$transaction(async (tx) => {
        await UserRepository.hardDeleteUser(staff.user_id, tx);
      });

      return {
        success: true,
        message: 'Staff deleted successfully',
        data: {
          staff_id: staff.id,
          user_id: staff.user_id,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to delete staff',
      );
    }
  }

  async updateStatus(id: string, status: number) {
    try {
      const allowed = new Set([0, 1, 2]);
      if (!allowed.has(Number(status))) {
        throw new BadRequestException(
          'Invalid status. Allowed: 0=pending, 1=active, 2=suspended',
        );
      }

      const staff = await this.prisma.staffProfile.findUnique({
        where: { id },
        select: { id: true, user_id: true },
      });
      if (!staff) throw new NotFoundException('Staff not found');

      // Prepare update data
      const updateData: any = { status: Number(status) };

      // If status is 1 (active), set approved_at to current date
      // If status is not 1, remove approved_at (set to null)
      if (Number(status) === 1) {
        updateData.approved_at = new Date();
      } else {
        updateData.approved_at = null;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: staff.user_id },
        data: updateData,
        select: {
          id: true,
          email: true,
          status: true,
          approved_at: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Staff status updated successfully',
        data: updatedUser,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException('Failed to update staff status');
    }
  }

  async updateCertificateStatus(
    certificateId: string,
    verified_status: 'pending' | 'verified' | 'rejected',
  ) {
    try {
      const allowed = new Set<CertificateVerificationStatus>([
        'pending',
        'verified',
        'rejected',
      ]);
      if (!allowed.has(verified_status as CertificateVerificationStatus)) {
        throw new BadRequestException(
          'Invalid verified_status. Allowed: pending, verified, rejected',
        );
      }

      const cert = await this.prisma.staffCertificate.findUnique({
        where: { id: certificateId },
        select: { id: true },
      });
      if (!cert) throw new NotFoundException('Certificate not found');

      const updated = await this.prisma.staffCertificate.update({
        where: { id: certificateId },
        data: {
          verified_status: verified_status as CertificateVerificationStatus,
        },
        select: {
          id: true,
          certificate_type: true,
          verified_status: true,
          uploaded_at: true,
          expiry_date: true,
        },
      });

      return {
        success: true,
        message: 'Certificate status updated',
        data: updated,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed to update certificate status',
      );
    }
  }

  async updateCertificate(
    certificateId: string,
    dto: UpdateStaffCertificateDto,
    file?: Express.Multer.File,
  ) {
    try {
      const cert = await this.prisma.staffCertificate.findUnique({
        where: { id: certificateId },
        select: { id: true, file_url: true, staff_id: true },
      });

      if (!cert) {
        throw new NotFoundException('Certificate not found');
      }

      const updateData: any = {};

      if (dto.certificate_type) {
        updateData.certificate_type = dto.certificate_type;
      }

      if (dto.expiry_date !== undefined) {
        if (dto.expiry_date === '' || dto.expiry_date === 'null') {
          updateData.expiry_date = null;
        } else {
          const parsedDate = new Date(dto.expiry_date);
          if (isNaN(parsedDate.getTime())) {
            throw new BadRequestException('Invalid expiry_date value');
          }
          updateData.expiry_date = parsedDate;
        }
      }

      if (dto.verified_status) {
        updateData.verified_status = dto.verified_status;
      }

      if (file) {
        // If an old file exists, delete it
        if (cert.file_url) {
          try {
            await SojebStorage.delete(
              appConfig().storageUrl.certificate + cert.file_url,
            );
          } catch (error) {
            console.error('Failed to delete old certificate file:', error);
          }
        }

        const fileName = `${StringHelper.randomString()}${file.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.certificate + fileName,
          file.buffer,
        );
        updateData.file_url = fileName;
        updateData.uploaded_at = new Date();
      }

      const updated = await this.prisma.staffCertificate.update({
        where: { id: certificateId },
        data: updateData,
        select: {
          id: true,
          staff_id: true,
          certificate_type: true,
          file_url: true,
          uploaded_at: true,
          verified_status: true,
          expiry_date: true,
        },
      });

      // Recalculate staff profile completion percentage
      await this.recalculateProfileCompletion(cert.staff_id);

      // Return formatted url for client
      if (updated.file_url) {
        updated.file_url = SojebStorage.url(
          appConfig().storageUrl.certificate + updated.file_url,
        );
      }

      return {
        success: true,
        message: 'Certificate updated successfully',
        data: updated,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to update certificate',
      );
    }
  }

  async deleteCertificate(certificateId: string) {
    try {
      const cert = await this.prisma.staffCertificate.findUnique({
        where: { id: certificateId },
        select: { id: true, file_url: true, staff_id: true },
      });

      if (!cert) {
        throw new NotFoundException('Certificate not found');
      }

      // Delete the file from storage if it exists
      if (cert.file_url) {
        try {
          await SojebStorage.delete(
            appConfig().storageUrl.certificate + cert.file_url,
          );
        } catch (error) {
          console.error('Failed to delete certificate file:', error);
        }
      }

      // Delete from database
      await this.prisma.staffCertificate.delete({
        where: { id: certificateId },
      });

      // Recalculate profile completion
      await this.recalculateProfileCompletion(cert.staff_id);

      return {
        success: true,
        message: 'Certificate deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to delete certificate',
      );
    }
  }

  async getStats() {
    try {
      const [total, pending, active, suspended] =
        await this.prisma.$transaction([
          this.prisma.staffProfile.count({
            where: {
              user: {
                deleted_at: null,
              },
            },
          }),
          this.prisma.staffProfile.count({
            where: {
              user: {
                status: 0,
                deleted_at: null,
              },
            },
          }),
          this.prisma.staffProfile.count({
            where: {
              user: {
                status: 1,
                deleted_at: null,
              },
            },
          }),
          this.prisma.staffProfile.count({
            where: {
              user: {
                status: 2,
                deleted_at: null,
              },
            },
          }),
        ]);

      return {
        success: true,
        message: 'Staff statistics fetched successfully',
        data: { total, pending, active, suspended },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch staff statistics',
      );
    }
  }

  async updateAdminNote(id: string, admin_note: string) {
    try {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!staff) throw new NotFoundException('Staff not found');

      const updated = await this.prisma.staffProfile.update({
        where: { id },
        data: { admin_note },
        select: {
          id: true,
          admin_note: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Admin note updated successfully',
        data: updated,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update admin note');
    }
  }
}
