import * as bcrypt from 'bcrypt';
import {
  CertificateType,
  CertificateVerificationStatus,
  EmployeePermissionType,
  EmployeeRole,
  PrismaClient,
  ProfessionRole,
  ReviewStatus,
  ServiceType,
  ShiftApplicationStatus,
  ShiftAttendanceStatus,
  ShiftStatus,
  ShiftType,
  StaffPreferenceType,
  TimesheetStatus,
} from '@prisma/client';
import appConfig from '../../config/app.config';

/**
 * Test Data Seeder Helper
 * Automatically seeds realistic test data for Admin, Care Homes (Service Providers),
 * Care Home Employees, Staff Profiles (Compliance, DBS, Address, Bank), Pay Rates,
 * Shifts, Applications, Attendances, Timesheets, Reviews, Preferences, Notifications, and FAQs on server startup.
 * 
 * Fully idempotent - skips records that already exist so duplicate data is never created.
 */
export class TestDataHelper {
  static async initializeTestData() {
    // Only run in local/development environment, never in production
    if (process.env.NODE_ENV === 'production') {
      console.log('ℹ️ Skipping test dataset initialization (production mode).');
      return;
    }

    const prisma = new PrismaClient();
    try {
      console.log('🌱 Checking & initializing test dataset...');

      const salt = appConfig().security.salt;
      const defaultPassword = await bcrypt.hash('12345678', salt);

      // ==========================================
      // 1. Roles
      // ==========================================
      const roles = [
        { id: '1', name: 'su_admin', title: 'Super Admin' },
        { id: '2', name: 'admin', title: 'Administrator' },
        { id: '3', name: 'service_provider', title: 'Service Provider' },
        { id: '4', name: 'staff', title: 'Staff Member' },
        { id: '5', name: 'employee', title: 'Employee' },
      ];

      for (const r of roles) {
        const existingRole = await prisma.role.findFirst({
          where: { name: r.name },
        });
        if (!existingRole) {
          await prisma.role.create({
            data: { id: r.id, name: r.name, title: r.title, status: 1 },
          });
        }
      }

      // ==========================================
      // 2. Care Home 1: Sunrise Healthcare Ltd
      // ==========================================
      let sunriseUser = await prisma.user.findFirst({
        where: { email: 'provider@sunrise.com' },
      });
      if (!sunriseUser) {
        sunriseUser = await prisma.user.create({
          data: {
            email: 'provider@sunrise.com',
            password: defaultPassword,
            type: 'service_provider',
            onboarding_step: 'completed',
            email_verified_at: new Date(),
            approved_at: new Date(),
            status: 1,
          },
        });
        console.log('   ✅ Care Home 1 User created: provider@sunrise.com');
      }

      let sunriseProvider = await prisma.serviceProviderInfo.findUnique({
        where: { user_id: sunriseUser.id },
      });
      if (!sunriseProvider) {
        sunriseProvider = await prisma.serviceProviderInfo.create({
          data: {
            user_id: sunriseUser.id,
            first_name: 'John',
            last_name: 'Doe',
            organization_name: 'Sunrise Healthcare Ltd',
            cqc_provider_number: '1-123456789',
            primary_address: '124 High Street, Camden, London, NW1 7HJ',
            facility_name: 'Sunrise Nursing Home',
            main_service_type: ServiceType.nursing_care,
            max_client_capacity: 60,
            mobile_code: '+44',
            mobile_number: '7123456780',
            emergency_bonus_increments: [10, 20, 30, 50],
          },
        });
        console.log('   ✅ Care Home 1 Profile created: Sunrise Healthcare Ltd');
      }

      // Pay rates for Sunrise Healthcare
      const sunrisePayRates = [
        { role: ProfessionRole.nurse, payRate: 28.0, margin: 4.0 },
        { role: ProfessionRole.senior_hca, payRate: 22.0, margin: 3.0 },
        { role: ProfessionRole.hca_carer, payRate: 18.5, margin: 2.5 },
        { role: ProfessionRole.support_worker, payRate: 17.0, margin: 2.0 },
      ];

      for (const pr of sunrisePayRates) {
        const existingRate = await prisma.providerPayRateByRole.findUnique({
          where: {
            service_provider_id_profession_role: {
              service_provider_id: sunriseProvider.id,
              profession_role: pr.role,
            },
          },
        });
        if (!existingRate) {
          await prisma.providerPayRateByRole.create({
            data: {
              service_provider_id: sunriseProvider.id,
              profession_role: pr.role,
              pay_rate_hourly: pr.payRate,
              platform_margin: pr.margin,
            },
          });
        }
      }

      // Care Home 1 Employee: Alice Morgan (Rota Manager)
      let sunriseEmployee = await prisma.employee.findUnique({
        where: { email: 'alice.manager@sunrise.com' },
      });
      if (!sunriseEmployee) {
        sunriseEmployee = await prisma.employee.create({
          data: {
            service_provider_id: sunriseProvider.id,
            first_name: 'Alice',
            last_name: 'Morgan',
            email: 'alice.manager@sunrise.com',
            mobile_code: '+44',
            mobile_number: '7123999888',
            employee_role: EmployeeRole.manager,
            is_active: true,
          },
        });
        const employeePermissions: EmployeePermissionType[] = [
          EmployeePermissionType.post_new_shifts,
          EmployeePermissionType.assign_shift_applicants,
          EmployeePermissionType.approve_timesheets,
          EmployeePermissionType.view_invoices,
          EmployeePermissionType.favorite_block_workers,
        ];
        for (const perm of employeePermissions) {
          await prisma.employeePermission.create({
            data: {
              employee_id: sunriseEmployee.id,
              permission: perm,
              is_granted: true,
            },
          });
        }
        console.log('   ✅ Care Home 1 Employee created: Alice Morgan (alice.manager@sunrise.com)');
      }

      // ==========================================
      // 3. Care Home 2: Bamfield Lodge Care Center
      // ==========================================
      let bamfieldUser = await prisma.user.findFirst({
        where: { email: 'care@bamfield.com' },
      });
      if (!bamfieldUser) {
        bamfieldUser = await prisma.user.create({
          data: {
            email: 'care@bamfield.com',
            password: defaultPassword,
            type: 'service_provider',
            onboarding_step: 'completed',
            email_verified_at: new Date(),
            approved_at: new Date(),
            status: 1,
          },
        });
        console.log('   ✅ Care Home 2 User created: care@bamfield.com');
      }

      let bamfieldProvider = await prisma.serviceProviderInfo.findUnique({
        where: { user_id: bamfieldUser.id },
      });
      if (!bamfieldProvider) {
        bamfieldProvider = await prisma.serviceProviderInfo.create({
          data: {
            user_id: bamfieldUser.id,
            first_name: 'Emily',
            last_name: 'Clark',
            organization_name: 'Bamfield Lodge Care Center',
            cqc_provider_number: '1-987654321',
            primary_address: '1 Bamfield Way, Bristol, BS14 0AU',
            facility_name: 'Bamfield Lodge',
            main_service_type: ServiceType.residential_care,
            max_client_capacity: 45,
            mobile_code: '+44',
            mobile_number: '7987654300',
            emergency_bonus_increments: [10, 25, 50],
          },
        });
        console.log('   ✅ Care Home 2 Profile created: Bamfield Lodge Care Center');
      }

      const bamfieldPayRates = [
        { role: ProfessionRole.nurse, payRate: 30.0, margin: 5.0 },
        { role: ProfessionRole.senior_hca, payRate: 23.0, margin: 3.5 },
        { role: ProfessionRole.hca_carer, payRate: 19.0, margin: 3.0 },
        { role: ProfessionRole.support_worker, payRate: 18.0, margin: 2.5 },
      ];

      for (const pr of bamfieldPayRates) {
        const existingRate = await prisma.providerPayRateByRole.findUnique({
          where: {
            service_provider_id_profession_role: {
              service_provider_id: bamfieldProvider.id,
              profession_role: pr.role,
            },
          },
        });
        if (!existingRate) {
          await prisma.providerPayRateByRole.create({
            data: {
              service_provider_id: bamfieldProvider.id,
              profession_role: pr.role,
              pay_rate_hourly: pr.payRate,
              platform_margin: pr.margin,
            },
          });
        }
      }

      // Care Home 2 Employee: Robert Taylor (Scheduler)
      let bamfieldEmployee = await prisma.employee.findUnique({
        where: { email: 'robert.scheduler@bamfield.com' },
      });
      if (!bamfieldEmployee) {
        bamfieldEmployee = await prisma.employee.create({
          data: {
            service_provider_id: bamfieldProvider.id,
            first_name: 'Robert',
            last_name: 'Taylor',
            email: 'robert.scheduler@bamfield.com',
            mobile_code: '+44',
            mobile_number: '7987111222',
            employee_role: EmployeeRole.scheduler,
            is_active: true,
          },
        });
        const bamfieldPermissions: EmployeePermissionType[] = [
          EmployeePermissionType.post_new_shifts,
          EmployeePermissionType.assign_shift_applicants,
          EmployeePermissionType.approve_timesheets,
        ];
        for (const perm of bamfieldPermissions) {
          await prisma.employeePermission.create({
            data: {
              employee_id: bamfieldEmployee.id,
              permission: perm,
              is_granted: true,
            },
          });
        }
        console.log('   ✅ Care Home 2 Employee created: Robert Taylor (robert.scheduler@bamfield.com)');
      }

      // ==========================================
      // 4. Healthcare Staff 1: Rahim Ahmed (HCA)
      // ==========================================
      let rahimUser = await prisma.user.findFirst({
        where: { email: 'rahim@example.com' },
      });
      if (!rahimUser) {
        rahimUser = await prisma.user.create({
          data: {
            email: 'rahim@example.com',
            password: defaultPassword,
            type: 'staff',
            onboarding_step: 'completed',
            email_verified_at: new Date(),
            approved_at: new Date(),
            status: 1,
          },
        });
      }

      let rahimStaff = await prisma.staffProfile.findUnique({
        where: { user_id: rahimUser.id },
      });
      if (!rahimStaff) {
        rahimStaff = await prisma.staffProfile.create({
          data: {
            user_id: rahimUser.id,
            first_name: 'Rahim',
            last_name: 'Ahmed',
            mobile_code: '+44',
            mobile_number: '7123456789',
            date_of_birth: new Date('1994-05-12'),
            right_to_work_status: 'Citizen',
            is_profile_complete: true,
            profile_completion: 100,
            can_apply_to_shifts: true,
            roles: ['hca_carer', 'senior_hca'],
          },
        });
        console.log('   ✅ Staff 1 created: Rahim Ahmed (rahim@example.com)');
      }

      // Rahim Bank Details
      const existingRahimBank = await prisma.staffBankDetails.findUnique({
        where: { staff_id: rahimStaff.id },
      });
      if (!existingRahimBank) {
        await prisma.staffBankDetails.create({
          data: {
            staff_id: rahimStaff.id,
            account_holder_name: 'Rahim Ahmed',
            sort_code: '12-34-56',
            account_number: '12345678',
            bank_name: 'Barclays Bank',
            is_verified: true,
          },
        });
      }

      // Rahim Current Address
      const existingRahimAddr = await prisma.staffCurrentAddress.findUnique({
        where: { staff_id: rahimStaff.id },
      });
      if (!existingRahimAddr) {
        await prisma.staffCurrentAddress.create({
          data: {
            staff_id: rahimStaff.id,
            address: '15 Camden High Street',
            city: 'London',
            zip: 'NW1 7JE',
            country: 'United Kingdom',
          },
        });
      }

      // Rahim Emergency Contact
      const existingRahimEmergency = await prisma.staffEmergencyContact.findUnique({
        where: { staff_id: rahimStaff.id },
      });
      if (!existingRahimEmergency) {
        await prisma.staffEmergencyContact.create({
          data: {
            staff_id: rahimStaff.id,
            name: 'Farzana Ahmed',
            mobile_code: '+44',
            mobile_number: '7111222333',
            relationship: 'Spouse',
          },
        });
      }

      // Rahim DBS Info
      const existingRahimDbs = await prisma.staffDbsInfo.findUnique({
        where: { staff_id: rahimStaff.id },
      });
      if (!existingRahimDbs) {
        await prisma.staffDbsInfo.create({
          data: {
            staff_id: rahimStaff.id,
            certificate_number: '001598745632',
            surname_as_certificate: 'Ahmed',
            date_of_birth_on_cert: new Date('1994-05-12'),
            certificate_print_date: new Date('2025-06-15'),
            is_registered_on_update: true,
          },
        });
      }

      // Rahim Certificates
      const rahimCerts = [
        { type: CertificateType.care_certificate, status: CertificateVerificationStatus.verified, expiry: new Date('2027-05-01') },
        { type: CertificateType.moving_handling, status: CertificateVerificationStatus.verified, expiry: new Date('2027-03-15') },
        { type: CertificateType.basic_life_support, status: CertificateVerificationStatus.verified, expiry: new Date('2027-01-20') },
        { type: CertificateType.safeguarding, status: CertificateVerificationStatus.verified, expiry: new Date('2026-12-30') },
      ];
      for (const cert of rahimCerts) {
        const existingCert = await prisma.staffCertificate.findFirst({
          where: { staff_id: rahimStaff.id, certificate_type: cert.type },
        });
        if (!existingCert) {
          await prisma.staffCertificate.create({
            data: {
              staff_id: rahimStaff.id,
              certificate_type: cert.type,
              verified_status: cert.status,
              expiry_date: cert.expiry,
            },
          });
        }
      }

      // ==========================================
      // 5. Healthcare Staff 2: Sarah Jenkins (Nurse)
      // ==========================================
      let sarahUser = await prisma.user.findFirst({
        where: { email: 'sarah@example.com' },
      });
      if (!sarahUser) {
        sarahUser = await prisma.user.create({
          data: {
            email: 'sarah@example.com',
            password: defaultPassword,
            type: 'staff',
            onboarding_step: 'completed',
            email_verified_at: new Date(),
            approved_at: new Date(),
            status: 1,
          },
        });
      }

      let sarahStaff = await prisma.staffProfile.findUnique({
        where: { user_id: sarahUser.id },
      });
      if (!sarahStaff) {
        sarahStaff = await prisma.staffProfile.create({
          data: {
            user_id: sarahUser.id,
            first_name: 'Sarah',
            last_name: 'Jenkins',
            mobile_code: '+44',
            mobile_number: '7987654321',
            date_of_birth: new Date('1991-08-23'),
            right_to_work_status: 'Permanent Resident',
            nmc_pin: '01A2345E',
            is_profile_complete: true,
            profile_completion: 100,
            can_apply_to_shifts: true,
            roles: ['nurse'],
          },
        });
        console.log('   ✅ Staff 2 created: Sarah Jenkins (sarah@example.com)');
      }

      // Sarah Bank Details
      const existingSarahBank = await prisma.staffBankDetails.findUnique({
        where: { staff_id: sarahStaff.id },
      });
      if (!existingSarahBank) {
        await prisma.staffBankDetails.create({
          data: {
            staff_id: sarahStaff.id,
            account_holder_name: 'Sarah Jenkins',
            sort_code: '40-02-15',
            account_number: '87654321',
            bank_name: 'HSBC UK',
            is_verified: true,
          },
        });
      }

      // Sarah Address
      const existingSarahAddr = await prisma.staffCurrentAddress.findUnique({
        where: { staff_id: sarahStaff.id },
      });
      if (!existingSarahAddr) {
        await prisma.staffCurrentAddress.create({
          data: {
            staff_id: sarahStaff.id,
            address: '42 Clifton Road',
            city: 'Bristol',
            zip: 'BS8 1AU',
            country: 'United Kingdom',
          },
        });
      }

      // Sarah Emergency Contact
      const existingSarahEmergency = await prisma.staffEmergencyContact.findUnique({
        where: { staff_id: sarahStaff.id },
      });
      if (!existingSarahEmergency) {
        await prisma.staffEmergencyContact.create({
          data: {
            staff_id: sarahStaff.id,
            name: 'Mark Jenkins',
            mobile_code: '+44',
            mobile_number: '7222333444',
            relationship: 'Brother',
          },
        });
      }

      // Sarah DBS Info
      const existingSarahDbs = await prisma.staffDbsInfo.findUnique({
        where: { staff_id: sarahStaff.id },
      });
      if (!existingSarahDbs) {
        await prisma.staffDbsInfo.create({
          data: {
            staff_id: sarahStaff.id,
            certificate_number: '001487239841',
            surname_as_certificate: 'Jenkins',
            date_of_birth_on_cert: new Date('1991-08-23'),
            certificate_print_date: new Date('2025-01-10'),
            is_registered_on_update: true,
          },
        });
      }

      // Sarah Certificates
      const sarahCerts = [
        { type: CertificateType.first_aid, status: CertificateVerificationStatus.verified, expiry: new Date('2027-08-01') },
        { type: CertificateType.basic_life_support, status: CertificateVerificationStatus.verified, expiry: new Date('2027-06-15') },
        { type: CertificateType.infection_control, status: CertificateVerificationStatus.verified, expiry: new Date('2027-04-10') },
        { type: CertificateType.medication_training, status: CertificateVerificationStatus.verified, expiry: new Date('2027-09-01') },
      ];
      for (const cert of sarahCerts) {
        const existingCert = await prisma.staffCertificate.findFirst({
          where: { staff_id: sarahStaff.id, certificate_type: cert.type },
        });
        if (!existingCert) {
          await prisma.staffCertificate.create({
            data: {
              staff_id: sarahStaff.id,
              certificate_type: cert.type,
              verified_status: cert.status,
              expiry_date: cert.expiry,
            },
          });
        }
      }

      // ==========================================
      // 6. Healthcare Staff 3: David Okonjo (Support Worker)
      // ==========================================
      let davidUser = await prisma.user.findFirst({
        where: { email: 'david@example.com' },
      });
      if (!davidUser) {
        davidUser = await prisma.user.create({
          data: {
            email: 'david@example.com',
            password: defaultPassword,
            type: 'staff',
            onboarding_step: 'completed',
            email_verified_at: new Date(),
            approved_at: new Date(),
            status: 1,
          },
        });
      }

      let davidStaff = await prisma.staffProfile.findUnique({
        where: { user_id: davidUser.id },
      });
      if (!davidStaff) {
        davidStaff = await prisma.staffProfile.create({
          data: {
            user_id: davidUser.id,
            first_name: 'David',
            last_name: 'Okonjo',
            mobile_code: '+44',
            mobile_number: '7456123789',
            date_of_birth: new Date('1996-11-04'),
            right_to_work_status: 'Citizen',
            is_profile_complete: true,
            profile_completion: 100,
            can_apply_to_shifts: true,
            roles: ['support_worker', 'hca_carer'],
          },
        });
        console.log('   ✅ Staff 3 created: David Okonjo (david@example.com)');
      }

      // David Bank Details
      const existingDavidBank = await prisma.staffBankDetails.findUnique({
        where: { staff_id: davidStaff.id },
      });
      if (!existingDavidBank) {
        await prisma.staffBankDetails.create({
          data: {
            staff_id: davidStaff.id,
            account_holder_name: 'David Okonjo',
            sort_code: '30-90-89',
            account_number: '55443322',
            bank_name: 'Lloyds Bank',
            is_verified: true,
          },
        });
      }

      // David Address
      const existingDavidAddr = await prisma.staffCurrentAddress.findUnique({
        where: { staff_id: davidStaff.id },
      });
      if (!existingDavidAddr) {
        await prisma.staffCurrentAddress.create({
          data: {
            staff_id: davidStaff.id,
            address: '8 Gloucester Road',
            city: 'Bristol',
            zip: 'BS7 8AE',
            country: 'United Kingdom',
          },
        });
      }

      // David Emergency Contact
      const existingDavidEmergency = await prisma.staffEmergencyContact.findUnique({
        where: { staff_id: davidStaff.id },
      });
      if (!existingDavidEmergency) {
        await prisma.staffEmergencyContact.create({
          data: {
            staff_id: davidStaff.id,
            name: 'Grace Okonjo',
            mobile_code: '+44',
            mobile_number: '7333444555',
            relationship: 'Mother',
          },
        });
      }

      // David DBS Info
      const existingDavidDbs = await prisma.staffDbsInfo.findUnique({
        where: { staff_id: davidStaff.id },
      });
      if (!existingDavidDbs) {
        await prisma.staffDbsInfo.create({
          data: {
            staff_id: davidStaff.id,
            certificate_number: '001639847251',
            surname_as_certificate: 'Okonjo',
            date_of_birth_on_cert: new Date('1996-11-04'),
            certificate_print_date: new Date('2025-08-20'),
            is_registered_on_update: true,
          },
        });
      }

      // David Certificates
      const davidCerts = [
        { type: CertificateType.care_certificate, status: CertificateVerificationStatus.verified, expiry: new Date('2027-10-01') },
        { type: CertificateType.moving_handling, status: CertificateVerificationStatus.verified, expiry: new Date('2027-07-20') },
        { type: CertificateType.health_safety, status: CertificateVerificationStatus.verified, expiry: new Date('2027-05-15') },
      ];
      for (const cert of davidCerts) {
        const existingCert = await prisma.staffCertificate.findFirst({
          where: { staff_id: davidStaff.id, certificate_type: cert.type },
        });
        if (!existingCert) {
          await prisma.staffCertificate.create({
            data: {
              staff_id: davidStaff.id,
              certificate_type: cert.type,
              verified_status: cert.status,
              expiry_date: cert.expiry,
            },
          });
        }
      }

      // ==========================================
      // 7. Care Home Preferences (Favorite Staff)
      // ==========================================
      const preferences = [
        { providerId: sunriseProvider.id, staffId: rahimStaff.id, type: StaffPreferenceType.favorite, reason: 'Reliable senior carer, highly recommended' },
        { providerId: sunriseProvider.id, staffId: sarahStaff.id, type: StaffPreferenceType.favorite, reason: 'Top tier registered nurse with acute care experience' },
        { providerId: bamfieldProvider.id, staffId: davidStaff.id, type: StaffPreferenceType.favorite, reason: 'Great support worker, residents love him' },
      ];
      for (const pref of preferences) {
        const existingPref = await prisma.providerStaffPreference.findUnique({
          where: {
            provider_id_staff_id_preference_type: {
              provider_id: pref.providerId,
              staff_id: pref.staffId,
              preference_type: pref.type,
            },
          },
        });
        if (!existingPref) {
          await prisma.providerStaffPreference.create({
            data: {
              provider_id: pref.providerId,
              staff_id: pref.staffId,
              preference_type: pref.type,
              reason: pref.reason,
            },
          });
        }
      }

      // ==========================================
      // 8. Seed Diverse Shifts, Timesheets & Attendances
      // ==========================================
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const fourDaysAgo = new Date(today);
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      const fiveDaysAgo = new Date(today);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      // Shift 1: Upcoming Published Day Shift
      const existingShift1 = await prisma.shift.findFirst({
        where: { posting_title: 'Senior Healthcare Assistant - Day Shift' },
      });
      if (!existingShift1) {
        const s1 = await prisma.shift.create({
          data: {
            service_provider_id: sunriseProvider.id,
            posting_title: 'Senior Healthcare Assistant - Day Shift',
            shift_type: ShiftType.day,
            profession_role: ProfessionRole.senior_hca,
            is_urgent: true,
            start_date: tomorrow,
            end_date: tomorrow,
            start_time: new Date(`${tomorrow.toISOString().slice(0, 10)}T08:00:00.000Z`),
            end_time: new Date(`${tomorrow.toISOString().slice(0, 10)}T20:00:00.000Z`),
            facility_name: 'Sunrise Nursing Home - East Wing',
            full_address: '124 High Street, Camden, London, NW1 7HJ',
            pay_rate_hourly: 22.0,
            staff_hourly_rate: 19.0,
            platform_margin: 3.0,
            status: ShiftStatus.published,
          },
        });
        // Staff application
        await prisma.shiftApplication.create({
          data: {
            shift_id: s1.id,
            staff_id: rahimStaff.id,
            status: ShiftApplicationStatus.pending,
          },
        });
      }

      // Shift 2: Critical Overdue Pending Timesheet (Submitted > 48h ago)
      let s2 = await prisma.shift.findFirst({
        where: { posting_title: 'Night HCA Carer - Urgent Cover' },
      });
      if (!s2) {
        s2 = await prisma.shift.create({
          data: {
            service_provider_id: sunriseProvider.id,
            assigned_staff_id: rahimStaff.id,
            posting_title: 'Night HCA Carer - Urgent Cover',
            shift_type: ShiftType.night,
            profession_role: ProfessionRole.hca_carer,
            is_urgent: true,
            start_date: threeDaysAgo,
            end_date: twoDaysAgo,
            start_time: new Date(`${threeDaysAgo.toISOString().slice(0, 10)}T20:00:00.000Z`),
            end_time: new Date(`${twoDaysAgo.toISOString().slice(0, 10)}T08:00:00.000Z`),
            facility_name: 'Sunrise Nursing Home - Dementia Unit',
            full_address: '124 High Street, Camden, London, NW1 7HJ',
            pay_rate_hourly: 18.5,
            staff_hourly_rate: 16.0,
            platform_margin: 2.5,
            status: ShiftStatus.assigned,
          },
        });

        // Attendance record
        await prisma.shiftAttendance.create({
          data: {
            shift_id: s2.id,
            staff_id: rahimStaff.id,
            status: ShiftAttendanceStatus.checked_out,
            check_in_time: new Date(`${threeDaysAgo.toISOString().slice(0, 10)}T19:55:00.000Z`),
            check_out_time: new Date(`${twoDaysAgo.toISOString().slice(0, 10)}T08:05:00.000Z`),
            location_check: 'Geofence Verified (Lat 51.539, Lng -0.142)',
          },
        });

        // Submitted 52 hours ago -> Critical Urgency
        const submitted52hAgo = new Date(Date.now() - 52 * 60 * 60 * 1000);
        await prisma.shiftTimesheet.create({
          data: {
            shift_id: s2.id,
            staff_id: rahimStaff.id,
            total_hours: 12.0,
            hourly_rate: 18.5,
            total_pay: 222.0,
            staff_hourly_rate: 16.0,
            staff_total_pay: 192.0,
            status: TimesheetStatus.submitted,
            submitted_at: submitted52hAgo,
            created_at: submitted52hAgo,
            verification_method: 'Geofence Verified',
            clock_in_verified: true,
            clock_out_verified: true,
          },
        });
      }

      // Shift 3: Warning Urgency Pending Timesheet (Submitted ~30h ago)
      let s3 = await prisma.shift.findFirst({
        where: { posting_title: 'Registered Nurse - Acute Care' },
      });
      if (!s3) {
        s3 = await prisma.shift.create({
          data: {
            service_provider_id: bamfieldProvider.id,
            assigned_staff_id: sarahStaff.id,
            posting_title: 'Registered Nurse - Acute Care',
            shift_type: ShiftType.day,
            profession_role: ProfessionRole.nurse,
            is_urgent: false,
            start_date: twoDaysAgo,
            end_date: twoDaysAgo,
            start_time: new Date(`${twoDaysAgo.toISOString().slice(0, 10)}T07:30:00.000Z`),
            end_time: new Date(`${twoDaysAgo.toISOString().slice(0, 10)}T19:30:00.000Z`),
            facility_name: 'Bamfield Lodge - Main Ward',
            full_address: '1 Bamfield Way, Bristol, BS14 0AU',
            pay_rate_hourly: 30.0,
            staff_hourly_rate: 25.0,
            platform_margin: 5.0,
            status: ShiftStatus.assigned,
          },
        });

        await prisma.shiftAttendance.create({
          data: {
            shift_id: s3.id,
            staff_id: sarahStaff.id,
            status: ShiftAttendanceStatus.checked_out,
            check_in_time: new Date(`${twoDaysAgo.toISOString().slice(0, 10)}T07:28:00.000Z`),
            check_out_time: new Date(`${twoDaysAgo.toISOString().slice(0, 10)}T19:32:00.000Z`),
            location_check: 'Geofence Verified (Lat 51.412, Lng -2.571)',
          },
        });

        const submitted30hAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
        await prisma.shiftTimesheet.create({
          data: {
            shift_id: s3.id,
            staff_id: sarahStaff.id,
            total_hours: 12.0,
            hourly_rate: 30.0,
            total_pay: 360.0,
            staff_hourly_rate: 25.0,
            staff_total_pay: 300.0,
            status: TimesheetStatus.submitted,
            submitted_at: submitted30hAgo,
            created_at: submitted30hAgo,
            verification_method: 'Manual Verification',
          },
        });
      }

      // Shift 4: Normal Urgency Pending Timesheet (Submitted ~8h ago)
      let s4 = await prisma.shift.findFirst({
        where: { posting_title: 'Support Worker - Evening Shift' },
      });
      if (!s4) {
        s4 = await prisma.shift.create({
          data: {
            service_provider_id: sunriseProvider.id,
            assigned_staff_id: davidStaff.id,
            posting_title: 'Support Worker - Evening Shift',
            shift_type: ShiftType.day,
            profession_role: ProfessionRole.support_worker,
            is_urgent: false,
            start_date: yesterday,
            end_date: yesterday,
            start_time: new Date(`${yesterday.toISOString().slice(0, 10)}T14:00:00.000Z`),
            end_time: new Date(`${yesterday.toISOString().slice(0, 10)}T22:00:00.000Z`),
            facility_name: 'Sunrise Nursing Home - Assisted Living',
            full_address: '124 High Street, Camden, London, NW1 7HJ',
            pay_rate_hourly: 17.0,
            staff_hourly_rate: 15.0,
            platform_margin: 2.0,
            status: ShiftStatus.assigned,
          },
        });

        await prisma.shiftAttendance.create({
          data: {
            shift_id: s4.id,
            staff_id: davidStaff.id,
            status: ShiftAttendanceStatus.checked_out,
            check_in_time: new Date(`${yesterday.toISOString().slice(0, 10)}T13:58:00.000Z`),
            check_out_time: new Date(`${yesterday.toISOString().slice(0, 10)}T22:02:00.000Z`),
          },
        });

        const submitted8hAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
        await prisma.shiftTimesheet.create({
          data: {
            shift_id: s4.id,
            staff_id: davidStaff.id,
            total_hours: 8.0,
            hourly_rate: 17.0,
            total_pay: 136.0,
            staff_hourly_rate: 15.0,
            staff_total_pay: 120.0,
            status: TimesheetStatus.submitted,
            submitted_at: submitted8hAgo,
            created_at: submitted8hAgo,
          },
        });
      }

      // Shift 5: Approved Unbilled Timesheet (For testing weekly invoice generation)
      let s5 = await prisma.shift.findFirst({
        where: { posting_title: 'Senior HCA - Weekend Coverage' },
      });
      if (!s5) {
        s5 = await prisma.shift.create({
          data: {
            service_provider_id: sunriseProvider.id,
            assigned_staff_id: rahimStaff.id,
            posting_title: 'Senior HCA - Weekend Coverage',
            shift_type: ShiftType.day,
            profession_role: ProfessionRole.senior_hca,
            is_urgent: false,
            start_date: fourDaysAgo,
            end_date: fourDaysAgo,
            start_time: new Date(`${fourDaysAgo.toISOString().slice(0, 10)}T08:00:00.000Z`),
            end_time: new Date(`${fourDaysAgo.toISOString().slice(0, 10)}T16:00:00.000Z`),
            facility_name: 'Sunrise Nursing Home - North Wing',
            full_address: '124 High Street, Camden, London, NW1 7HJ',
            pay_rate_hourly: 22.0,
            staff_hourly_rate: 19.0,
            platform_margin: 3.0,
            status: ShiftStatus.assigned,
          },
        });

        await prisma.shiftAttendance.create({
          data: {
            shift_id: s5.id,
            staff_id: rahimStaff.id,
            status: ShiftAttendanceStatus.checked_out,
            check_in_time: new Date(`${fourDaysAgo.toISOString().slice(0, 10)}T07:55:00.000Z`),
            check_out_time: new Date(`${fourDaysAgo.toISOString().slice(0, 10)}T16:05:00.000Z`),
          },
        });

        await prisma.shiftTimesheet.create({
          data: {
            shift_id: s5.id,
            staff_id: rahimStaff.id,
            total_hours: 8.0,
            hourly_rate: 22.0,
            total_pay: 176.0,
            staff_hourly_rate: 19.0,
            staff_total_pay: 152.0,
            status: TimesheetStatus.approved,
            reviewed_at: threeDaysAgo,
            submitted_at: fourDaysAgo,
            created_at: fourDaysAgo,
          },
        });
      }

      // Shift 6: Invoiced & Unpaid (Outstanding supplier debt) + 5-Star Review
      let s6 = await prisma.shift.findFirst({
        where: { posting_title: 'Specialist Nurse - High Dependency Unit' },
      });
      if (!s6) {
        s6 = await prisma.shift.create({
          data: {
            service_provider_id: sunriseProvider.id,
            assigned_staff_id: sarahStaff.id,
            posting_title: 'Specialist Nurse - High Dependency Unit',
            shift_type: ShiftType.day,
            profession_role: ProfessionRole.nurse,
            is_urgent: true,
            start_date: fiveDaysAgo,
            end_date: fiveDaysAgo,
            start_time: new Date(`${fiveDaysAgo.toISOString().slice(0, 10)}T08:00:00.000Z`),
            end_time: new Date(`${fiveDaysAgo.toISOString().slice(0, 10)}T20:00:00.000Z`),
            facility_name: 'Sunrise Nursing Home - ICU Unit',
            full_address: '124 High Street, Camden, London, NW1 7HJ',
            pay_rate_hourly: 28.0,
            staff_hourly_rate: 24.0,
            platform_margin: 4.0,
            status: ShiftStatus.assigned,
          },
        });

        await prisma.shiftAttendance.create({
          data: {
            shift_id: s6.id,
            staff_id: sarahStaff.id,
            status: ShiftAttendanceStatus.checked_out,
            check_in_time: new Date(`${fiveDaysAgo.toISOString().slice(0, 10)}T07:50:00.000Z`),
            check_out_time: new Date(`${fiveDaysAgo.toISOString().slice(0, 10)}T20:05:00.000Z`),
          },
        });

        await prisma.shiftTimesheet.create({
          data: {
            shift_id: s6.id,
            staff_id: sarahStaff.id,
            total_hours: 12.0,
            hourly_rate: 28.0,
            total_pay: 336.0,
            staff_hourly_rate: 24.0,
            staff_total_pay: 288.0,
            status: TimesheetStatus.invoiced,
            xero_invoice_id: 'XERO-INV-SUN-101',
            xero_invoice_number: 'INV-2026-0042',
            xero_status: 'AUTHORISED',
            reviewed_at: fourDaysAgo,
            submitted_at: fiveDaysAgo,
            created_at: fiveDaysAgo,
          },
        });

        await prisma.paymentTransaction.create({
          data: {
            user_id: sunriseUser.id,
            type: 'xero_invoice',
            reference_number: 'INV-2026-0042',
            order_id: s6.id,
            amount: 336.0,
            currency: 'GBP',
            status: 'pending',
            raw_status: 'AUTHORISED',
          },
        });

        // Review for Sarah Jenkins
        await prisma.staffPerformanceReview.create({
          data: {
            provider_id: sunriseProvider.id,
            staff_id: sarahStaff.id,
            shift_id: s6.id,
            rating: 5,
            feedback: 'Sarah is an outstanding nurse! Extremely professional, compassionate, and attentive to residents.',
            status: ReviewStatus.approved,
          },
        });
      }

      // Shift 7: Fully Paid Shift & Timesheet + 5-Star Review
      let s7 = await prisma.shift.findFirst({
        where: { posting_title: 'Senior HCA - Night Shift' },
      });
      if (!s7) {
        s7 = await prisma.shift.create({
          data: {
            service_provider_id: bamfieldProvider.id,
            assigned_staff_id: davidStaff.id,
            posting_title: 'Senior HCA - Night Shift',
            shift_type: ShiftType.night,
            profession_role: ProfessionRole.hca_carer,
            is_urgent: false,
            start_date: fiveDaysAgo,
            end_date: fourDaysAgo,
            start_time: new Date(`${fiveDaysAgo.toISOString().slice(0, 10)}T20:00:00.000Z`),
            end_time: new Date(`${fourDaysAgo.toISOString().slice(0, 10)}T08:00:00.000Z`),
            facility_name: 'Bamfield Lodge - East Wing',
            full_address: '1 Bamfield Way, Bristol, BS14 0AU',
            pay_rate_hourly: 19.0,
            staff_hourly_rate: 16.0,
            platform_margin: 3.0,
            status: ShiftStatus.completed,
          },
        });

        await prisma.shiftAttendance.create({
          data: {
            shift_id: s7.id,
            staff_id: davidStaff.id,
            status: ShiftAttendanceStatus.checked_out,
            check_in_time: new Date(`${fiveDaysAgo.toISOString().slice(0, 10)}T19:50:00.000Z`),
            check_out_time: new Date(`${fourDaysAgo.toISOString().slice(0, 10)}T08:10:00.000Z`),
          },
        });

        await prisma.shiftTimesheet.create({
          data: {
            shift_id: s7.id,
            staff_id: davidStaff.id,
            total_hours: 12.0,
            hourly_rate: 19.0,
            total_pay: 228.0,
            staff_hourly_rate: 16.0,
            staff_total_pay: 192.0,
            status: TimesheetStatus.paid,
            xero_invoice_id: 'XERO-INV-BAM-089',
            xero_invoice_number: 'INV-2026-0010',
            xero_status: 'PAID',
            paid_at: twoDaysAgo,
            staff_pay_status: 'paid',
            staff_paid_at: twoDaysAgo,
            reviewed_at: fourDaysAgo,
            submitted_at: fiveDaysAgo,
            created_at: fiveDaysAgo,
          },
        });

        await prisma.paymentTransaction.create({
          data: {
            user_id: bamfieldUser.id,
            type: 'xero_invoice',
            reference_number: 'INV-2026-0010',
            order_id: s7.id,
            amount: 228.0,
            currency: 'GBP',
            status: 'paid',
            raw_status: 'PAID',
            paid_amount: 228.0,
            paid_currency: 'GBP',
          },
        });

        // Review for David Okonjo
        await prisma.staffPerformanceReview.create({
          data: {
            provider_id: bamfieldProvider.id,
            staff_id: davidStaff.id,
            shift_id: s7.id,
            rating: 5,
            feedback: 'David was fantastic throughout the night shift. Reliable, punctual, and very helpful.',
            status: ReviewStatus.approved,
          },
        });
      }

      // ==========================================
      // 9. Seed Notifications (Notification Bell)
      // ==========================================
      const sampleEvents = [
        { type: 'timesheet_submitted', text: 'A new timesheet was submitted for urgent review.' },
        { type: 'timesheet_approved', text: 'Your timesheet has been approved by the Care Home manager.' },
        { type: 'shift_assigned', text: 'You have been assigned to an upcoming shift.' },
      ];

      for (const ev of sampleEvents) {
        let existingEvent = await prisma.notificationEvent.findFirst({
          where: { type: ev.type },
        });
        if (!existingEvent) {
          existingEvent = await prisma.notificationEvent.create({
            data: {
              type: ev.type,
              text: ev.text,
              status: 1,
            },
          });
        }

        // Add 1 notification for Care Home user
        if (ev.type === 'timesheet_submitted' && sunriseUser) {
          const existingNotif = await prisma.notification.findFirst({
            where: { receiver_id: sunriseUser.id, notification_event_id: existingEvent.id },
          });
          if (!existingNotif) {
            await prisma.notification.create({
              data: {
                receiver_id: sunriseUser.id,
                notification_event_id: existingEvent.id,
                status: 1,
              },
            });
          }
        }

        // Add 1 notification for Staff Rahim
        if (ev.type === 'timesheet_approved' && rahimUser) {
          const existingNotif = await prisma.notification.findFirst({
            where: { receiver_id: rahimUser.id, notification_event_id: existingEvent.id },
          });
          if (!existingNotif) {
            await prisma.notification.create({
              data: {
                receiver_id: rahimUser.id,
                notification_event_id: existingEvent.id,
                status: 1,
              },
            });
          }
        }
      }

      // ==========================================
      // 10. Seed FAQs & Website Info
      // ==========================================
      const faqs = [
        {
          question: 'How do staff submit timesheets?',
          answer: 'Once a shift finishes, navigate to My Shifts, tap the completed shift, verify hours and clock in/out times, and tap Submit Timesheet.',
        },
        {
          question: 'When is weekly payroll processed?',
          answer: 'Payroll is processed every Monday for all approved timesheets from the preceding week, with direct bank transfers into staff accounts.',
        },
        {
          question: 'How do care homes post urgent shifts?',
          answer: 'Care homes can create a shift with the "Urgent Cover" toggle enabled, which broadcasts high-priority push notifications to available compliant staff.',
        },
      ];

      for (let i = 0; i < faqs.length; i++) {
        const f = faqs[i];
        const existingFaq = await prisma.faq.findFirst({
          where: { question: f.question },
        });
        if (!existingFaq) {
          await prisma.faq.create({
            data: {
              question: f.question,
              answer: f.answer,
              sort_order: i + 1,
              status: 1,
            },
          });
        }
      }

      console.log('✅ Complete test dataset initialized successfully!');
      console.log('   --- Default Test Credentials (Password: 12345678) ---');
      console.log('   👑 Admin: admin@example.com');
      console.log('   🏥 Care Home 1: provider@sunrise.com (Sunrise Healthcare Ltd)');
      console.log('   👩‍💼 Care Home 1 Manager: alice.manager@sunrise.com (Alice Morgan)');
      console.log('   🏥 Care Home 2: care@bamfield.com (Bamfield Lodge Care Center)');
      console.log('   👨‍💼 Care Home 2 Scheduler: robert.scheduler@bamfield.com (Robert Taylor)');
      console.log('   👩‍⚕️ Staff 1: rahim@example.com (Rahim Ahmed - HCA, Verified Bank & Certificates)');
      console.log('   👩‍⚕️ Staff 2: sarah@example.com (Sarah Jenkins - Nurse, Verified Bank & Certificates)');
      console.log('   👨‍⚕️ Staff 3: david@example.com (David Okonjo - Support Worker, Verified Bank & Certificates)');
    } catch (error) {
      console.error('❌ Error initializing test dataset:', error);
    } finally {
      await prisma.$disconnect();
    }
  }
}
