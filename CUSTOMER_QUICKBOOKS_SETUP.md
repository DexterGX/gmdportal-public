# Customer Directory - QuickBooks Integration Setup Guide

## Overview

The Customer Directory feature allows you to sync customer information from QuickBooks Online and use it throughout the portal for assigning slabs, creating estimates, and managing customer relationships.

## Database Changes

### New Customer Model

```prisma
model Customer {
  id                 String    @id @default(uuid())
  quickbooksId       String?   @unique
  displayName        String
  companyName        String?
  givenName          String?
  familyName         String?
  email              String?
  phone              String?
  mobile             String?
  billAddr           Json?
  shipAddr           Json?
  balance            Decimal?
  lastSyncedAt       DateTime?
  quickbooksData     Json?
  notes              String?
  active             Boolean   @default(true)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  closetJobs         ClosetJob[]
}
```

### ClosetJob Update

Added optional customer reference:

```prisma
customerId      String?
customer        Customer?  @relation(fields: [customerId], references: [id])
```

## Required: Run Database Migration

```bash
npx prisma migrate dev --name add_customers
npx prisma generate
```

## QuickBooks Setup

### 1. Create QuickBooks App

1. Go to https://developer.intuit.com
2. Sign in with your Intuit account
3. Click "Create an app"
4. Select "QuickBooks Online and Payments"
5. Fill in app details:
   - **App name**: GM Design Portal
   - **Redirect URI**: `http://localhost:3000/api/quickbooks/callback`
   - For production: `https://yourdomain.com/api/quickbooks/callback`

### 2. Get API Credentials

From your app dashboard, copy:

- **Client ID**
- **Client Secret**
- **Company ID** (Realm ID) - Found in QuickBooks under Settings → Company Settings

### 3. Obtain OAuth Tokens

You'll need to implement OAuth 2.0 flow or use QuickBooks OAuth Playground:

#### Option A: OAuth Playground (Quickest for Testing)

1. Visit: https://developer.intuit.com/app/developer/playground
2. Select your app
3. Click "Get OAuth2 Credentials"
4. Select scopes: `com.intuit.quickbooks.accounting`
5. Click "Get Access Token"
6. Copy the **Access Token** and **Refresh Token**

#### Option B: Implement OAuth Flow (Production)

See `src/lib/quickbooks.ts` for token refresh implementation.
You'll need to create OAuth callback routes to handle the authorization flow.

### 4. Update Environment Variables

Add to `.env.local`:

```bash
# QuickBooks Online API Configuration
QUICKBOOKS_CLIENT_ID=YOUR_CLIENT_ID_HERE
QUICKBOOKS_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
QUICKBOOKS_REALM_ID=YOUR_COMPANY_ID_HERE
QUICKBOOKS_ACCESS_TOKEN=YOUR_ACCESS_TOKEN_HERE
QUICKBOOKS_REFRESH_TOKEN=YOUR_REFRESH_TOKEN_HERE
QUICKBOOKS_ENVIRONMENT=sandbox  # Use "production" when ready
```

### 5. Token Management

**Important**: QuickBooks access tokens expire after 1 hour. Refresh tokens expire after 100 days.

The system will automatically attempt to refresh tokens when they expire. When a refresh happens:

1. Check the server logs for new tokens
2. Update `.env.local` with new tokens
3. Restart the dev server

**For production**, you should:

- Store tokens in your database
- Implement automatic token refresh and storage
- Set up token rotation

## Features

### 1. Customer List (`/customers`)

- View all synced customers
- Search by name, company, email, or phone
- Sort by any column
- Filter by active/inactive status
- See linked closet jobs
- Click to view customer details

### 2. QuickBooks Sync (`/customers/sync`)

Admin-only page to:

- Manually sync customers from QuickBooks
- View sync statistics
- See success/error counts

### 3. Customer Integration Points

#### Closet Jobs

When creating a closet job, you can now:

- Link to an existing customer
- Use customer data for estimates
- Track all jobs per customer

#### Future Enhancements

- Slab sales assignment to customers
- Customer purchase history
- Revenue reporting by customer
- Email integration using customer email

## Access Control

### Allowed Roles

- **Admin**: Full access including sync
- **Sales**: View customers, no sync
- **Office**: View customers, no sync

### Navigation

The Customer Directory appears in the sidebar under "Programs" for users with appropriate roles.

## API Endpoints

### `POST /api/customers/sync`

Syncs all customers from QuickBooks.

**Authentication**: Admin only

**Response**:

```json
{
  "success": true,
  "stats": {
    "total": 150,
    "created": 10,
    "updated": 140,
    "errors": 0
  }
}
```

## Usage Examples

### 1. First Time Setup

1. Configure QuickBooks credentials in `.env.local`
2. Restart dev server
3. Navigate to `/customers/sync`
4. Click "Start Sync"
5. Wait for sync to complete
6. View customers at `/customers`

### 2. Regular Updates

- Run sync periodically (daily/weekly) to keep customer data current
- Sync can be automated with a cron job hitting the API endpoint

### 3. Using Customers in Closet Jobs

```typescript
// When creating a closet job, you can now link a customer:
const job = await prisma.closetJob.create({
  data: {
    customerId: "customer-uuid",
    customerName: customer.displayName, // Still stored for quick access
    customerPhone: customer.phone,
    // ... other fields
  },
});
```

## Troubleshooting

### "QuickBooks not configured" Error

- Verify all environment variables are set
- Restart dev server after adding variables
- Check for typos in variable names

### "QuickBooks authentication failed"

- Access token has expired
- Run token refresh or re-authorize via OAuth Playground
- Update `.env.local` with new tokens

### "Failed to fetch QuickBooks customers"

- Check Company ID (Realm ID) is correct
- Verify you're using correct environment (sandbox vs production)
- Ensure QuickBooks account has active customers

### No Customers Returned

- Check if QuickBooks company has active customers
- Verify API scopes include `com.intuit.quickbooks.accounting`
- Try fetching a specific customer by ID to test connection

## Security Notes

1. **Never commit tokens to git**
2. Add `.env.local` to `.gitignore`
3. Use different credentials for development and production
4. Rotate tokens regularly
5. Implement rate limiting for sync endpoint in production
6. Consider encrypting sensitive data in the database

## Next Steps

After setup:

1. ✅ Run database migration
2. ✅ Configure QuickBooks credentials
3. ✅ Test sync with sandbox environment
4. ⏭ Update closet job creation to use customer dropdown
5. ⏭ Add customer detail page
6. ⏭ Implement automatic token refresh in production
7. ⏭ Add customer selection to slab sales
