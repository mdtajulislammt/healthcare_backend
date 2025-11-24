/*
  Warnings:

  - You are about to drop the column `address` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `avatar` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `date_of_birth` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `domain` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `first_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `last_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phone_number` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `zip_code` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('residential_care', 'domiciliary_care', 'nursing_care', 'supported_living', 'other');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('nurse', 'senior_hca', 'hca_carer', 'support_worker');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('care_certificate', 'moving_handling', 'first_aid', 'basic_life_support', 'infection_control', 'safeguarding', 'health_safety', 'equality_diversity', 'coshh', 'medication_training', 'nvq_iii', 'additional_training');

-- CreateEnum
CREATE TYPE "CertificateVerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('manager', 'scheduler', 'hr_manager', 'finance_officer', 'compliance_officer', 'general_staff');

-- CreateEnum
CREATE TYPE "EmployeePermissionType" AS ENUM ('post_new_shifts', 'assign_shift_applicants', 'add_emergency_bonus', 'favorite_block_workers', 'approve_timesheets', 'dispute_timesheets', 'view_invoices', 'manage_team_permissions');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('draft', 'published', 'assigned', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('long_day', 'day', 'night', 'live_in', 'sleep_in', 'part_time', 'other');

-- CreateEnum
CREATE TYPE "ProfessionRole" AS ENUM ('nurse', 'senior_hca', 'hca_carer', 'support_worker', 'other');

-- CreateEnum
CREATE TYPE "ShiftApplicationStatus" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "ShiftAttendanceStatus" AS ENUM ('not_checked_in', 'checked_in', 'checked_out');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('pending_submission', 'submitted', 'under_review', 'approved', 'rejected', 'paid');

-- CreateEnum
CREATE TYPE "StaffPreferenceType" AS ENUM ('favorite', 'blocked');

-- CreateEnum
CREATE TYPE "ActivityLogActionType" AS ENUM ('shift_apply', 'timesheet_submit', 'employee_create', 'shift_checkin', 'shift_checkout', 'profile_update', 'shift_assign', 'timesheet_approve', 'timesheet_reject', 'shift_create', 'shift_update', 'shift_delete');

-- DropIndex
DROP INDEX "users_domain_key";

-- DropIndex
DROP INDEX "users_username_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "address",
DROP COLUMN "avatar",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "date_of_birth",
DROP COLUMN "domain",
DROP COLUMN "first_name",
DROP COLUMN "gender",
DROP COLUMN "last_name",
DROP COLUMN "name",
DROP COLUMN "phone_number",
DROP COLUMN "state",
DROP COLUMN "username",
DROP COLUMN "zip_code",
ADD COLUMN     "onboarding_step" TEXT DEFAULT 'account_type',
ALTER COLUMN "status" SET DEFAULT 0,
ALTER COLUMN "password" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "service_provider_infos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "mobile_code" TEXT,
    "mobile_number" TEXT,
    "facility_name" TEXT,
    "brand_logo_url" TEXT,
    "agreed_to_terms" BOOLEAN NOT NULL DEFAULT false,
    "organization_name" TEXT NOT NULL,
    "website" TEXT,
    "cqc_provider_number" TEXT NOT NULL,
    "vat_tax_id" TEXT,
    "primary_address" TEXT NOT NULL,
    "main_service_type" "ServiceType" NOT NULL,
    "max_client_capacity" INTEGER NOT NULL,
    "support_documents_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_provider_infos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "service_provider_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile_code" TEXT,
    "mobile_number" TEXT,
    "photo_url" TEXT,
    "employee_role" "EmployeeRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_permissions" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "permission" "EmployeePermissionType" NOT NULL,
    "is_granted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "mobile_code" TEXT,
    "mobile_number" TEXT,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "photo_url" TEXT,
    "bio" TEXT,
    "experience" TEXT,
    "agreed_to_terms" BOOLEAN NOT NULL DEFAULT false,
    "roles" "StaffRole"[],
    "right_to_work_status" TEXT NOT NULL,
    "cv_url" TEXT,
    "profile_completion" INTEGER NOT NULL DEFAULT 0,
    "is_profile_complete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_certificates" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "certificate_type" "CertificateType" NOT NULL,
    "file_url" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_status" "CertificateVerificationStatus" NOT NULL DEFAULT 'pending',
    "expiry_date" TIMESTAMP(3),
    "expiry_notified_at" TIMESTAMP(3),

    CONSTRAINT "staff_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_dbs_infos" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "surname_as_certificate" TEXT NOT NULL,
    "date_of_birth_on_cert" TIMESTAMP(3) NOT NULL,
    "certificate_print_date" TIMESTAMP(3) NOT NULL,
    "is_registered_on_update" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_dbs_infos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEmergencyContact" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "name" TEXT,
    "mobile_code" TEXT NOT NULL,
    "mobile_number" TEXT NOT NULL,
    "relationship" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEducation" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "institution_name" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field_of_study" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCurrentAddress" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "from_date" TIMESTAMP(3),
    "to_date" TIMESTAMP(3),
    "evidence_file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCurrentAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPreviousAddress" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "from_date" TIMESTAMP(3),
    "to_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPreviousAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "service_provider_id" TEXT NOT NULL,
    "created_by_employee_id" TEXT,
    "assigned_staff_id" TEXT,
    "posting_title" TEXT NOT NULL,
    "shift_type" "ShiftType" NOT NULL,
    "profession_role" "ProfessionRole" NOT NULL,
    "is_urgent" BOOLEAN NOT NULL DEFAULT false,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "facility_name" TEXT NOT NULL,
    "full_address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "pay_rate_hourly" DOUBLE PRECISION NOT NULL,
    "signing_bonus" DOUBLE PRECISION DEFAULT 0,
    "internal_po_number" TEXT,
    "emergency_bonus" DOUBLE PRECISION DEFAULT 0,
    "notes" TEXT,
    "status" "ShiftStatus" NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_applications" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "status" "ShiftApplicationStatus" NOT NULL DEFAULT 'pending',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "shift_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_attendances" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "status" "ShiftAttendanceStatus" NOT NULL DEFAULT 'not_checked_in',
    "check_in_time" TIMESTAMP(3),
    "check_out_time" TIMESTAMP(3),
    "location_check" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_timesheets" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "total_hours" DOUBLE PRECISION,
    "hourly_rate" DOUBLE PRECISION,
    "total_pay" DOUBLE PRECISION,
    "notes" TEXT,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'pending_submission',
    "verification_method" TEXT,
    "clock_in_verified" BOOLEAN DEFAULT false,
    "clock_out_verified" BOOLEAN DEFAULT false,
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_staff_preferences" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "set_by_employee_id" TEXT,
    "preference_type" "StaffPreferenceType" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_staff_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_performance_reviews" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "created_by" TEXT,
    "admin_alert" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action_type" "ActivityLogActionType" NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_provider_infos_user_id_key" ON "service_provider_infos"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employee_permissions_employee_id_permission_key" ON "employee_permissions"("employee_id", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_user_id_key" ON "staff_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_dbs_infos_staff_id_key" ON "staff_dbs_infos"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "StaffEmergencyContact_staff_id_key" ON "StaffEmergencyContact"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "StaffCurrentAddress_staff_id_key" ON "StaffCurrentAddress"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPreviousAddress_staff_id_key" ON "StaffPreviousAddress"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_applications_shift_id_staff_id_key" ON "shift_applications"("shift_id", "staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_attendances_shift_id_key" ON "shift_attendances"("shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_timesheets_shift_id_key" ON "shift_timesheets"("shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_staff_preferences_provider_id_staff_id_preference__key" ON "provider_staff_preferences"("provider_id", "staff_id", "preference_type");

-- CreateIndex
CREATE UNIQUE INDEX "staff_performance_reviews_shift_id_staff_id_key" ON "staff_performance_reviews"("shift_id", "staff_id");

-- AddForeignKey
ALTER TABLE "service_provider_infos" ADD CONSTRAINT "service_provider_infos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_service_provider_id_fkey" FOREIGN KEY ("service_provider_id") REFERENCES "service_provider_infos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_permissions" ADD CONSTRAINT "employee_permissions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_certificates" ADD CONSTRAINT "staff_certificates_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_dbs_infos" ADD CONSTRAINT "staff_dbs_infos_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmergencyContact" ADD CONSTRAINT "StaffEmergencyContact_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEducation" ADD CONSTRAINT "StaffEducation_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCurrentAddress" ADD CONSTRAINT "StaffCurrentAddress_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPreviousAddress" ADD CONSTRAINT "StaffPreviousAddress_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_service_provider_id_fkey" FOREIGN KEY ("service_provider_id") REFERENCES "service_provider_infos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_employee_id_fkey" FOREIGN KEY ("created_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_applications" ADD CONSTRAINT "shift_applications_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_applications" ADD CONSTRAINT "shift_applications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_attendances" ADD CONSTRAINT "shift_attendances_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_attendances" ADD CONSTRAINT "shift_attendances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_timesheets" ADD CONSTRAINT "shift_timesheets_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_timesheets" ADD CONSTRAINT "shift_timesheets_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_staff_preferences" ADD CONSTRAINT "provider_staff_preferences_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "service_provider_infos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_staff_preferences" ADD CONSTRAINT "provider_staff_preferences_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_staff_preferences" ADD CONSTRAINT "provider_staff_preferences_set_by_employee_id_fkey" FOREIGN KEY ("set_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_performance_reviews" ADD CONSTRAINT "staff_performance_reviews_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "service_provider_infos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_performance_reviews" ADD CONSTRAINT "staff_performance_reviews_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_performance_reviews" ADD CONSTRAINT "staff_performance_reviews_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
