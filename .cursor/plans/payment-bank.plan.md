<!-- 5d5647ca-39e3-48e8-adab-9700d0d220cb e71b6454-712e-489a-b46f-1e548406e7c8 -->
# Bank-to-Bank Payment System Architecture Plan

## Overview

Design a complete bank-to-bank transfer payment flow for three user types: Admin (platform), Service Provider (clients), and Staff (workers) with commission structure, automated bank transfers, and transaction tracking.

## Current State Analysis

### Existing Infrastructure:

- ✅ Stripe integration (`StripePayment` class) - Can use Stripe ACH for bank transfers
- ✅ `PaymentTransaction` model (basic structure)
- ✅ `UserPaymentMethod` model
- ✅ `ShiftTimesheet` with `paid_at` field
- ✅ `Shift` with `pay_rate_hourly`, `signing_bonus`, `emergency_bonus`
- ✅ User `billing_id` (Stripe customer ID)

### Missing Components:

- ❌ Bank account storage model
- ❌ Bank account verification system
- ❌ Bank transfer processing logic
- ❌ Commission/fee calculation logic
- ❌ Automated bank transfer processing
- ❌ Payment history and reporting

## Payment Flow Architecture (Bank-to-Bank)

### 1. Service Provider → Staff Payment Flow

**When:** Timesheet approved by admin/service provider

**Process:**

1. Admin/Service Provider approves timesheet (`status = approved`)
2. System calculates total payment amount
3. Initiate bank transfer from Service Provider's bank account to Staff's bank account
4. Payment processed via bank transfer API (Stripe ACH, Plaid, or direct bank API)
5. Update timesheet `paid_at` and `status = paid` (after confirmation)
6. Create `PaymentTransaction` record

**Payment Calculation:**

- Base Pay = `total_hours × hourly_rate`
- Bonuses = `signing_bonus + emergency_bonus`
- Total Staff Pay = Base Pay + Bonuses

**Bank Transfer Details Required:**

- Service Provider: Bank account (routing number, account number, account holder name)
- Staff: Bank account (routing number/IBAN, account number, account holder name, bank name)

### 2. Service Provider → Platform Commission Flow

**When:** Service Provider pays staff

**Process:**

1. Calculate platform commission (e.g., 10-15% of total)
2. Initiate separate bank transfer from Service Provider to Platform account
3. Or deduct commission before transferring to staff (net payment)
4. Record commission transaction

**Commission Structure:**

- Platform Fee = `(total_staff_pay × commission_rate)`
- Service Provider Pays = `total_staff_pay + platform_fee`
- Staff Receives = `total_staff_pay` (gross) OR `total_staff_pay - commission` (net)

## Database Schema Updates

### New Model: `BankAccount`

```prisma
model BankAccount {
  id                String   @id @default(cuid())
  user_id           String
  account_holder_name String
  account_number    String   // Encrypted
  routing_number    String?  // For US/UK (encrypted)
  iban              String?  // For international (encrypted)
  swift_code        String?  // BIC/SWIFT code
  bank_name         String
  account_type      String   // 'checking' | 'savings'
  country           String?
  is_verified       Boolean  @default(false)
  is_default        Boolean  @default(false)
  verified_at       DateTime?
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  @@map("bank_accounts")
}
```

### Enhanced `PaymentTransaction` Model

```prisma
model PaymentTransaction {
  // Existing fields...
  
  // New fields for bank transfers:
  transaction_type      String?  // 'staff_payment' | 'commission' | 'refund'
  from_user_id         String?  // Service Provider who pays
  to_user_id           String?  // Staff who receives
  timesheet_id         String?  // Link to timesheet
  commission_amount    Decimal?
  platform_fee_percentage Decimal?
  bank_transfer_id     String?  // Bank transfer reference ID
  bank_reference_number String?  // Bank transaction reference
  transfer_status      String?  // 'pending' | 'processing' | 'completed' | 'failed'
  initiated_at         DateTime?
  completed_at         DateTime?
  failure_reason       String?
  
  // Relations
  from_user User? @relation("PaymentFrom", fields: [from_user_id], references: [id])
  to_user   User? @relation("PaymentTo", fields: [to_user_id], references: [id])
}
```

## Implementation Plan

### Phase 1: Database Schema Updates

1. Create `BankAccount` model in schema.prisma
2. Enhance `PaymentTransaction` model with bank transfer fields
3. Add `commission_rate` to `ServiceProviderInfo` (optional per-provider rate)
4. Create migration for new models and fields

### Phase 2: Bank Account Management

1. Create `BankAccountService`:

   - `addBankAccount(userId, accountDetails)` - Add bank account
   - `verifyBankAccount(accountId)` - Verify account ownership (micro-deposits)
   - `setDefaultAccount(userId, accountId)` - Set default account
   - `getBankAccounts(userId)` - List user's bank accounts
   - `deleteBankAccount(accountId)` - Remove bank account

2. Create endpoints for bank account CRUD operations
3. Implement encryption for sensitive bank data

### Phase 3: Payment Service Creation

1. Create `PaymentService` with methods:

   - `processStaffPayment(timesheetId, serviceProviderId)` - Initiate bank transfer
   - `calculateCommission(totalAmount, commissionRate)` - Calculate platform fee
   - `initiateBankTransfer(fromAccountId, toAccountId, amount)` - Start bank transfer via Stripe ACH
   - `checkTransferStatus(transferId)` - Check bank transfer status
   - `handleTransferWebhook(webhookData)` - Process bank transfer webhooks
   - `recordTransaction(transactionData)` - Record payment transaction
   - `retryFailedTransfer(transactionId)` - Retry failed transfers

### Phase 4: Stripe ACH Integration

1. Update `StripePayment` class:

   - `createBankAccountToken(accountDetails)` - Create bank account token
   - `verifyBankAccount(customerId, accountId)` - Initiate micro-deposit verification
   - `createACHTransfer(sourceAccount, destinationAccount, amount)` - Create ACH transfer
   - `getTransferStatus(transferId)` - Get transfer status
   - Handle Stripe ACH webhooks

### Phase 5: Payment Processing Integration

1. Hook into timesheet approval flow
2. Auto-trigger bank transfer when timesheet approved
3. Handle payment failures and retries
4. Send notifications for payment status
5. Update timesheet status after transfer confirmation

### Phase 6: Admin Payment Management

1. Admin dashboard for payment overview
2. Manual payment processing option
3. Payment history and reports
4. Commission tracking and reporting
5. Failed transfer management

### Phase 7: Service Provider Payment Management

1. Service Provider bank account management
2. Payment history view
3. Invoice generation
4. Payment reminders for pending payments
5. Commission breakdown view

### Phase 8: Staff Payment Management

1. Staff bank account management
2. Payment history view
3. Payment notifications
4. Earnings dashboard
5. Pending payments view

## Payment Scenarios

### Scenario 1: Standard Shift Payment via Bank Transfer

1. Staff completes shift → Timesheet submitted
2. Service Provider/Admin approves → `status = approved`
3. System calculates: Staff Pay = £100, Commission = £10 (10%)
4. Initiate bank transfer: Service Provider's bank → Staff's bank (£100)
5. Initiate bank transfer: Service Provider's bank → Platform bank (£10)
6. Transfer status: 'pending' → 'processing' → 'completed' (1-3 business days)
7. Update timesheet: `paid_at` and `status = paid` (after confirmation)
8. Staff receives: £100 in bank account
9. Platform receives: £10 in bank account

### Scenario 2: Bank Transfer Failure Handling

1. Bank transfer fails (insufficient funds, invalid account, etc.)
2. System marks transaction as 'failed'
3. Notify Service Provider and Admin
4. Timesheet remains in "approved" status (not "paid")
5. Admin can:

   - Retry transfer after Service Provider fixes account
   - Manually mark as paid if resolved externally
   - Reject timesheet if payment cannot be processed

### Scenario 3: Bank Account Verification

1. User adds bank account details
2. System initiates micro-deposit verification (2 small deposits)
3. User confirms deposit amounts
4. Bank account marked as verified
5. Account can now be used for transfers

## Files to Create/Modify

### New Files:

- `src/modules/payment/bank-account/bank-account.service.ts` - Bank account management
- `src/modules/payment/bank-account/bank-account.controller.ts` - Bank account endpoints
- `src/modules/payment/bank-account/dto/add-bank-account.dto.ts` - DTOs
- `src/modules/payment/payment.service.ts` - Main payment processing logic
- `src/modules/payment/payment.controller.ts` - Payment endpoints
- `src/modules/payment/dto/process-payment.dto.ts` - Payment DTOs
- `src/modules/admin/payment/` - Admin payment management
- `src/modules/application/service-provider/payment/` - Service Provider payment
- `src/modules/application/staff/payment/` - Staff payment history

### Modify Files:

- `prisma/schema.prisma` - Add BankAccount model, enhance PaymentTransaction
- `src/modules/admin/timesheet/timesheet.service.ts` - Add payment trigger on approval
- `src/common/lib/Payment/stripe/StripePayment.ts` - Add ACH/bank transfer methods
- `src/modules/auth/auth.service.ts` - Add bank account collection during registration

## Security Considerations

- Encrypt bank account details (account numbers, routing numbers) at rest
- PCI compliance for storing bank account information
- Verify bank account ownership before allowing transfers (micro-deposits)
- Validate payment amounts before processing
- Implement idempotency for transfer requests
- Log all payment transactions
- Handle webhook security (bank API signature verification)
- Two-factor authentication for initiating large transfers
- Rate limiting on transfer requests
- Audit trail for all payment operations

## Testing Strategy

- Unit tests for payment calculations
- Integration tests for Stripe ACH API calls
- Test bank account verification flow
- Test payment failure scenarios (insufficient funds, invalid accounts)
- Test commission calculations
- Test refund flows (reverse bank transfers)
- Test webhook handling for transfer status updates
- Test multi-currency support (if applicable)
- Test concurrent transfer requests

### To-dos

- [ ] Update PaymentTransaction model in schema.prisma with new fields (transaction_type, from_user_id, to_user_id, timesheet_id, commission_amount, etc.)
- [ ] Create PaymentService with processStaffPayment, calculateCommission, and payment processing methods
- [ ] Integrate payment processing into timesheet approval flow in admin timesheet service
- [ ] Add Stripe Connect or transfer methods for staff payouts in StripePayment class
- [ ] Create admin payment management module for viewing transactions and manual processing
- [ ] Create staff payment history and payout management module
- [ ] Create service provider payment management (payment methods, history, invoices)