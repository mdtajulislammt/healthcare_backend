<!-- 5d5647ca-39e3-48e8-adab-9700d0d220cb 6784b5ed-5dd3-40fa-87eb-822632c0f5ea -->
# Xero Payment Integration Plan

## Goal

Integrate **Xero** with your existing NestJS + Prisma backend so that:

- Approved **ShiftTimesheet** → becomes an **Invoice** in Xero for the Care Home.
- Invoice & payment statuses are **synced back** to your app.
- Staff payments remain **manual bank transfers**, but the app tracks what should be paid and what is already paid.

## High-Level Flow (aligned with client’s 7 steps)

1. **Care Home onboards** in your app (already done in your domain).
2. **Care Home posts shifts** → staff complete shifts (existing Shift + Geofence + Timesheet logic).
3. **Timesheet ready**:

- When a timesheet is **approved** (admin side), we:
- Calculate total amount.
- Create/Update a corresponding **Xero Invoice** for that Care Home.

4. **Invoice via Xero**:

- Invoice is created in Xero (via API) and linked to:
- your `ServiceProviderInfo` (client)
- one or more `ShiftTimesheet` records.
- App shows invoice details (status, amount, due date) by reading from your DB (synced from Xero).

5. **Care Home pays Vital Hands**:

- Care Home pays through normal bank transfer referencing the Xero invoice.
- Xero updates invoice status to `PAID`.
- Your backend gets this via webhook/polling and updates local `PaymentTransaction` + `ShiftTimesheet` (e.g. mark as `paid`).

6. **Vital Hands pays staff manually**:

- Staff payout still done **manually** via bank.
- Backend only tracks:
- how much is “payable” to each staff
- when it was marked as “paid” (manual toggle in admin panel).

7. **Repeat**.

## Data Model Adjustments

1. **Link ServiceProvider to Xero Contact**

- Add optional field to `ServiceProviderInfo`:
- `xero_contact_id: String?` (stored contact ID from Xero).
- When onboarding/first time invoicing, either:
- Create Xero Contact for this Care Home, or
- Link to existing contact (if client provides mapping).

2. **Link Timesheet → Xero Invoice**

- Extend `ShiftTimesheet` model:
- `xero_invoice_id: String?` (Xero invoice ID)
- `xero_invoice_number: String?`
- `xero_status: String?` (e.g. `DRAFT`, `AUTHORISED`, `PAID`)

3. **PaymentTransaction for Care Home Payments (platform income)**

- Reuse/extend existing `PaymentTransaction` model to store:
- `type = 'xero_invoice'`
- `store_id` or `order_id` → `xero_invoice_id`
- `amount`, `currency`
- `status` mapped from Xero invoice state (`pending`, `paid`)

4. **Staff Payout Tracking (manual)**

- Option A: extend `ShiftTimesheet`:
- `staff_pay_status: 'pending' | 'paid'`
- `staff_paid_at: DateTime?`
- Option B: add separate `StaffPayout` model (more advanced). For first iteration, Option A is enough.

## Backend Modules & Responsibilities

### 1. XeroModule (new)

- Files under `src/modules/payment/xero/`:
- `xero.module.ts`
- `xero.service.ts` – wraps Xero API calls.
- `xero.controller.ts` – handles OAuth callback + webhooks.

#### XeroService key methods

- `connectXero(userId)` (optional if you want OAuth per tenant; for now, likely a single Vital Hands tenant):
- Redirects admin to Xero OAuth consent.
- `handleOAuthCallback(code)`:
- Exchanges auth code for access/refresh tokens.
- Stores tokens & tenant ID in a `XeroAuth` table or config.
- `syncContactForServiceProvider(serviceProviderId)`:
- Creates/updates Xero Contact using `ServiceProviderInfo` (org name, email, address).
- Saves `xero_contact_id`.
- `createInvoiceForTimesheet(timesheetId)`:
- Fetches `ShiftTimesheet` + related `Shift` + `ServiceProviderInfo`.
- Ensures Xero contact exists.
- Builds invoice payload:
- Single line item with shift/timesheet description (e.g. `"Nurse shift 01/01/2025 – 8h"`).
- Uses pay rate × hours; includes VAT if needed.
- Calls Xero `CreateInvoice` API.
- Saves `xero_invoice_id`, `xero_invoice_number`, `xero_status` in `ShiftTimesheet`.
- Creates/updates `PaymentTransaction` row for invoice.
- `updateInvoiceStatusFromXero(invoiceId)`:
- Gets invoice from Xero.
- Updates local `PaymentTransaction.status` + `ShiftTimesheet.xero_status` and, if `PAID`, sets `TimesheetStatus.paid` and `paid_at`.

### 2. TimesheetService integration (Admin)

- When **admin approves** a timesheet (`forceApprove` / `resolveDispute` → `approved`):

1. Call `XeroService.createInvoiceForTimesheet(timesheetId)`.
2. If invoice created, store invoice info on timesheet.
3. Return invoice meta in API response so admin UI can show the link/number.

- Optional: Bulk invoicing
- Endpoint: `POST /admin/timesheets/generate-invoices` to invoicing all approved/uninvoiced timesheets in one go (one invoice per timesheet or grouped – depends on business rule).

### 3. Xero Webhook / Polling

You need a way to know when Care Home pays the invoice.

**Option A: Webhooks (preferred if Xero supports for invoices in your region)**

- `POST /payment/xero/webhook`
- Verify Xero signature (if applicable).
- For each invoice event:
- Find `ShiftTimesheet` by `xero_invoice_id`.
- Update status:
- If invoice now `PAID`, set:
- `PaymentTransaction.status = 'paid'`
- `ShiftTimesheet.xero_status = 'PAID'`
- `ShiftTimesheet.paid_at = now`

**Option B: Scheduled polling (fallback)**

- Cron job (e.g. every 1–6 hours):
- Fetch all invoices from Xero with status `AUTHORISED` / `PARTIALLY_PAID` not yet `PAID` in our DB.
- Call `getInvoices` from Xero, update corresponding records.

### 4. Staff Payout (manual but tracked)

Backend doesn’t trigger bank transfer, but:

- Admin UI action: `Mark staff payout as paid`.
- Backend changes on that action:
- For that `ShiftTimesheet`:
- `staff_pay_status = 'paid'`
- `staff_paid_at = now`
- This gives staff & admin clear view:
- “Invoice paid by Care Home” vs “Staff paid by Vital Hands”.

Later, if you automate staff payout, we can plug into this field.

## API Endpoints (Backend)

### Xero connection & sync

- `GET /payment/xero/connect` (admin): redirect to Xero OAuth.
- `GET /payment/xero/callback?code=...` (public): handle OAuth, store tokens.

### Invoice creation

- `POST /admin/timesheets/:id/invoice`
- Creates Xero invoice for a single approved timesheet.
- `POST /admin/timesheets/invoices/bulk`
- Creates invoices for multiple approved timesheets.

### Invoice sync & webhook

- `POST /payment/xero/webhook` (if using webhooks)
- Receives invoice updates → updates local DB.
- `POST /admin/timesheets/:id/sync-invoice`
- Manually refresh a single timesheet’s invoice status from Xero.

### Staff payout admin endpoints

- `POST /admin/timesheets/:id/mark-staff-paid`
- Marks staff payout as paid for that timesheet.
- `GET /admin/staff/:staffId/earnings`
- Shows total hours, total payable, total paid, outstanding.

## UI / Reporting Impact (for later)

- **Care Home / Vital Hands view**
- List of invoices per Care Home with status: `Draft`, `Awaiting Payment`, `Paid`.
- **Staff view**
- Shifts and earnings with `Invoice paid?` and `Staff paid?` flags.

## Security & Config

- Store Xero tokens securely (encrypted at rest).
- Don’t expose raw invoice IDs in public URLs without auth.
- Keep Xero keys and tenant IDs in env/config, not hard-coded.

## Next Steps

1. Confirm with client:

- Per-timesheet vs grouped invoicing (weekly/monthly per Care Home).
- Tax/VAT rules.

2. Once clarified, implement:

- XeroModule + XeroService skeleton.
- Timesheet → Invoice creation for a **single** timesheet.
- Read-only invoice status sync.

3. Then gradually add bulk invoicing, webhooks/polling, and staff payout tracking in the admin UI.

### To-dos

- [ ] Implement Xero OAuth flow and token storage (XeroAuthService, /xero/connect, /xero/callback)
- [ ] Create XeroInvoiceService to map approved timesheets to Xero invoices and store invoice IDs/status
- [ ] Hook timesheet approval flow to call XeroInvoiceService and update billing status
- [ ] Implement a scheduled job or endpoint to sync invoice payment status from Xero back into the app
- [ ] Add payout_status and payout tracking for staff earnings linked to paid invoices