# Xero API Integration - Step-by-Step Testing Guide

## Prerequisites

### 1. Set Up Xero App
1. Go to [Xero Developer Portal](https://developer.xero.com/)
2. Sign in or create an account
3. Create a new app:
   - Click "New app"
   - Choose "Web app" integration type
   - Fill in:
     - **App name**: Your app name (e.g., "Healthcare Backend")
     - **Company URL**: Your company website
     - **Redirect URI**: `http://localhost:4000/payment/xero/callback`
   - Select scopes:
     - `accounting.transactions`
     - `accounting.contacts`
     - `accounting.settings`
4. Copy your **Client ID** and **Client Secret**

### 2. Update Environment Variables
Add to your `.env` file:
```env
XERO_CLIENT_ID=your_client_id_here
XERO_CLIENT_SECRET=your_client_secret_here
XERO_REDIRECT_URI=http://localhost:4000/api/payment/xero/callback
```

### 3. Run Database Migration
```bash
npx prisma db push
# or
npx prisma migrate dev --name add_xero_integration
```

### 4. Start Your Server
```bash
yarn start:dev
# or
npm run start:dev
```

---

## Step-by-Step API Testing

### **Step 1: Check Xero Connection Status**

**Endpoint:** `GET /payment/xero/status`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**cURL:**
```bash
curl -X GET "http://localhost:4000/api/payment/xero/status" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response (Not Connected):**
```json
{
  "success": true,
  "connected": false
}
```

---

### **Step 2: Connect Xero Account**

**Endpoint:** `GET /payment/xero/connect`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**cURL:**
```bash
curl -X GET "http://localhost:4000/api/payment/xero/connect" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -L
```

**What Happens:**
- This will redirect you to Xero's authorization page
- You'll need to log in to Xero and authorize the app
- Xero will redirect back to your callback URL with an authorization code

**Alternative (Browser):**
Just open in browser:
```
http://localhost:4000/api/payment/xero/connect
```
(Make sure you're logged in as Admin with valid JWT token in cookies/headers)

---

### **Step 3: Handle OAuth Callback**

**Endpoint:** `GET /payment/xero/callback?code=AUTHORIZATION_CODE`

**Note:** This happens automatically when Xero redirects back. But you can test manually:

**cURL:**
```bash
curl -X GET "http://localhost:4000/api/payment/xero/callback?code=YOUR_AUTH_CODE_FROM_XERO"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Xero connected successfully"
}
```

---

### **Step 4: Verify Connection Status Again**

**Endpoint:** `GET /payment/xero/status`

**cURL:**
```bash
curl -X GET "http://localhost:4000/api/payment/xero/status" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response (Connected):**
```json
{
  "success": true,
  "connected": true
}
```

---

### **Step 5: Get Approved Timesheets**

**Endpoint:** `GET /admin/timesheets?status=approved`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**cURL:**
```bash
curl -X GET "http://localhost:4000/api/admin/timesheets?status=approved" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "timesheets": [
      {
        "id": "timesheet_id_here",
        "shift_id": "shift_id",
        "staff_id": "staff_id",
        "total_hours": 8,
        "hourly_rate": 15.50,
        "total_pay": 124.00,
        "status": "approved",
        ...
      }
    ],
    "pagination": {...}
  }
}
```

**Note:** Copy a `timesheet_id` from the response for next steps.

---

### **Step 6: Create Xero Invoice for Timesheet**

**Endpoint:** `POST /admin/timesheets/:id/      `

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**cURL:**
```bash
curl -X POST "http://localhost:4000/api/admin/timesheets/TIMESHEET_ID_HERE/invoice" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Xero invoice created successfully",
  "data": {
    "invoiceId": "xero-invoice-id-here",
    "invoiceNumber": "INV-001"
  }
}
```

---

### **Step 7: Approve Timesheet (Auto-Creates Invoice)**

**Endpoint:** `POST /admin/timesheets/:id/force-approve`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "message": "Timesheet approved"
}
```

**cURL:**
```bash
curl -X POST "http://localhost:4000/api/admin/timesheets/TIMESHEET_ID_HERE/force-approve" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Timesheet approved"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Timesheet force approved successfully",
  "data": {
    "id": "timesheet_id",
    "status": "approved",
    "xero_invoice_id": "xero-invoice-id",
    "xero_invoice_number": "INV-001",
    "invoice": {
      "invoiceId": "xero-invoice-id",
      "invoiceNumber": "INV-001"
    },
    ...
  }
}
```

---

### **Step 8: Sync Invoice Status from Xero**

**Endpoint:** `POST /admin/timesheets/:id/sync-invoice`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**cURL:**
```bash
curl -X POST "http://localhost:4000/api/admin/timesheets/TIMESHEET_ID_HERE/sync-invoice" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Invoice status synced from Xero",
  "data": {
    "id": "timesheet_id",
    "xero_invoice_id": "xero-invoice-id",
    "xero_invoice_number": "INV-001",
    "xero_status": "PAID",
    "status": "paid",
    "paid_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### **Step 9: Sync All Invoices (Bulk)**

**Endpoint:** `POST /admin/timesheets/sync-all-invoices`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**cURL:**
```bash
curl -X POST "http://localhost:4000/api/admin/timesheets/sync-all-invoices" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Synced 5 invoices. 0 failed.",
  "data": {
    "success": 5,
    "failed": 0,
    "errors": []
  }
}
```

---

### **Step 10: Mark Staff Payout as Paid**

**Endpoint:** `POST /admin/timesheets/:id/mark-staff-paid`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**cURL:**
```bash
curl -X POST "http://localhost:4000/api/admin/timesheets/TIMESHEET_ID_HERE/mark-staff-paid" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Staff payout marked as paid",
  "data": {
    "id": "timesheet_id",
    "staff_pay_status": "paid",
    "staff_paid_at": "2024-01-15T10:30:00Z",
    ...
  }
}
```

---

### **Step 11: Get Staff Earnings Summary**

**Endpoint:** `GET /admin/timesheets/staff/:staffId/earnings`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**cURL:**
```bash
curl -X GET "http://localhost:4000/api/admin/timesheets/staff/STAFF_ID_HERE/earnings" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Staff earnings fetched successfully",
  "data": {
    "summary": {
      "total_hours": 40,
      "total_payable": 620.00,
      "total_paid": 310.00,
      "outstanding": 310.00
    },
    "timesheets": {
      "pending": 2,
      "paid": 2,
      "total": 4
    },
    "breakdown": [...]
  }
}
```

---

### **Step 12: Create Bulk Invoices**

**Endpoint:** `POST /admin/timesheets/invoices/bulk`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "timesheetIds": [
    "timesheet_id_1",
    "timesheet_id_2",
    "timesheet_id_3"
  ]
}
```

**cURL:**
```bash
curl -X POST "http://localhost:4000/api/admin/timesheets/invoices/bulk" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timesheetIds": ["timesheet_id_1", "timesheet_id_2"]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Created 2 invoices. 0 failed.",
  "data": {
    "success": 2,
    "failed": 0,
    "invoices": [
      {
        "timesheetId": "timesheet_id_1",
        "invoiceId": "xero-invoice-id-1",
        "invoiceNumber": "INV-001"
      },
      {
        "timesheetId": "timesheet_id_2",
        "invoiceId": "xero-invoice-id-2",
        "invoiceNumber": "INV-002"
      }
    ],
    "errors": []
  }
}
```

---

## Testing Flow Summary

1. ✅ **Connect Xero** → `/payment/xero/connect`
2. ✅ **Check Status** → `/payment/xero/status`
3. ✅ **Approve Timesheet** → `/admin/timesheets/:id/force-approve` (auto-creates invoice)
4. ✅ **Sync Invoice Status** → `/admin/timesheets/:id/sync-invoice`
5. ✅ **Mark Staff Paid** → `/admin/timesheets/:id/mark-staff-paid`
6. ✅ **View Earnings** → `/admin/timesheets/staff/:staffId/earnings`

---

## Troubleshooting

### Error: "Xero not connected"
- Make sure you completed Step 2 (OAuth connection)
- Check that tokens are stored in `xero_auths` table

### Error: "Service provider not found"
- Ensure the timesheet's shift has a `service_provider_info` relation
- Check that service provider has required fields (organization_name, primary_address)

### Error: "Only approved timesheets can be invoiced"
- Timesheet must be in `approved` status before creating invoice
- Use `/admin/timesheets/:id/force-approve` first

### Error: "Failed to create Xero invoice"
- Check Xero app has correct scopes
- Verify service provider contact exists in Xero
- Check Xero account has valid organization selected

---

## Notes

- All endpoints require Admin role and JWT authentication
- Invoice creation happens automatically when timesheet is approved
- Invoice status sync can be done manually or scheduled
- Staff payout tracking is separate from invoice payment status

