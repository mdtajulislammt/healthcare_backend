-- AlterTable
ALTER TABLE "service_provider_infos" ADD COLUMN     "xero_contact_id" TEXT;

-- AlterTable
ALTER TABLE "shift_timesheets" ADD COLUMN     "staff_paid_at" TIMESTAMP(3),
ADD COLUMN     "staff_pay_status" TEXT,
ADD COLUMN     "xero_invoice_id" TEXT,
ADD COLUMN     "xero_invoice_number" TEXT,
ADD COLUMN     "xero_status" TEXT;

-- CreateTable
CREATE TABLE "user_device_tokens" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,

    CONSTRAINT "user_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_bank_details" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "sort_code" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "bank_name" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_bank_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_auths" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xero_auths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_device_tokens_token_key" ON "user_device_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "staff_bank_details_staff_id_key" ON "staff_bank_details"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "xero_auths_tenant_id_key" ON "xero_auths"("tenant_id");

-- AddForeignKey
ALTER TABLE "user_device_tokens" ADD CONSTRAINT "user_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_bank_details" ADD CONSTRAINT "staff_bank_details_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
