# Pipedrive Integration Setup Guide

This guide will help you set up the Pipedrive integration to sync deals as prospects into the GM Design Portal.

## Prerequisites

- Pipedrive account with API access
- Admin access to GM Design Portal
- Access to `.env.local` file

## Step 1: Get Your Pipedrive API Token

1. Log in to your Pipedrive account
2. Click on your profile picture in the top-right corner
3. Select **Settings** from the dropdown
4. Navigate to **Personal Preferences** → **API**
5. Copy your **Personal API token**
   - If you don't have one, click **Generate new token**
   - Keep this token secure - treat it like a password

## Step 2: Find Your Company Domain

Your company domain is the subdomain in your Pipedrive URL:

- If your Pipedrive URL is `https://yourcompany.pipedrive.com`
- Your company domain is: `yourcompany`

## Step 3: Configure Environment Variables

Add these variables to your `.env.local` file:

```env
# Pipedrive API Configuration
PIPEDRIVE_API_TOKEN=your_actual_api_token_here
PIPEDRIVE_COMPANY_DOMAIN=yourcompany
```

**Example:**

```env
PIPEDRIVE_API_TOKEN=abc123def456ghi789jkl012mno345pqr678stu
PIPEDRIVE_COMPANY_DOMAIN=gmdesign
```

## Step 4: Restart the Development Server

After adding the environment variables:

1. Stop the Next.js dev server (Ctrl+C in terminal)
2. Restart it: `npm run dev`

## Step 5: Run Your First Sync

1. Navigate to **Customers** page
2. Click the **Sync from Pipedrive** button (purple button)
3. Review the configuration info on the sync page
4. Click **Start Sync from Pipedrive**
5. Watch the progress bar as deals are synced

## What Gets Synced?

The integration syncs the following from Pipedrive:

### Deal Information

- Title
- Value/Amount
- Status (open, won, lost)
- Stage information
- Deal owner
- Created/Updated dates

### Contact Information (from associated person)

- Name (first and last)
- Email (primary)
- Phone (primary)

### Organization Information

- Company/Organization name
- Organization ID for linking

## How Data Maps to Customers

| Pipedrive Field          | Customer Field  | Notes                               |
| ------------------------ | --------------- | ----------------------------------- |
| Deal ID                  | `pipedriveId`   | Unique identifier                   |
| Deal Title / Person Name | `displayName`   | Display name for customer           |
| Organization Name        | `companyName`   | Company name if available           |
| Person First Name        | `givenName`     | First name                          |
| Person Last Name         | `familyName`    | Last name                           |
| Person Email (primary)   | `email`         | Primary email address               |
| Person Phone (primary)   | `phone`         | Primary phone number                |
| Full Deal JSON           | `pipedriveData` | Complete deal object stored as JSON |
| -                        | `type`          | Always set to `PROSPECT`            |
| Deal Status              | `active`        | Active if "open" or "won"           |

## Customer Types

All Pipedrive deals are imported as **PROSPECTS**:

- **PROSPECT** = Potential customer from Pipedrive deals
- **CLIENT** = Active customer (from QuickBooks or manually set)
- **CONTRACTOR** = Contractor/subcontractor (auto-detected or manual)

You can manually change a prospect to a client after they convert.

## Sync Behavior

### First Sync (New Deals)

- Creates new Customer records with `type = PROSPECT`
- Stores full Pipedrive data in `pipedriveData` JSON field
- Links contact and organization info

### Subsequent Syncs (Updates)

- Updates existing customers if Pipedrive ID matches
- Refreshes contact information and deal status
- Preserves any custom changes you made locally

### Duplicate Detection

- Uses `pipedriveId` to identify existing customers
- Will not create duplicates if the same deal syncs twice
- Safe to run multiple times

## Filtering Prospects

On the **Customer Directory** page:

1. Use the **Type** dropdown filter
2. Select **Prospects** to see only Pipedrive deals
3. Or select **All** to see prospects, clients, and contractors together

## Best Practices

### Regular Syncing

- Run Pipedrive sync **before** giving new estimates
- Ensures your sales team has latest prospect data
- Recommended: sync daily or before major quote sessions

### Workflow Integration

1. **Pipedrive**: Sales team manages deals
2. **Portal Sync**: Import deals as prospects
3. **Quote Creation**: Create quotes/estimates for prospects
4. **QuickBooks**: When deal closes, customer appears in QuickBooks
5. **Portal Sync**: QuickBooks sync updates customer to CLIENT type

### Data Flow

```
Pipedrive (Deals) → Portal (Prospects) → Quotes → QuickBooks (Customers) → Portal (Clients)
```

## Troubleshooting

### "Failed to connect to Pipedrive" Error

**Possible causes:**

1. API token is incorrect or expired
2. Company domain is wrong
3. Environment variables not loaded

**Solutions:**

- Double-check your API token in Pipedrive settings
- Verify company domain matches your Pipedrive URL
- Restart the dev server after changing `.env.local`
- Check console for detailed error messages

### No Deals Syncing

**Check:**

- Do you have any deals in Pipedrive?
- Are the deals in "deleted" status? (deleted deals are excluded)
- Check browser console and server logs for errors

### Missing Contact Information

**Reason:** Deal has no associated Person in Pipedrive

**Solution:**

- In Pipedrive, edit the deal and link it to a Person/Contact
- Re-run the sync

### Duplicate Customers

**This shouldn't happen** because we use `pipedriveId` as unique identifier.

**If it does:**

1. Check if customers have different Pipedrive IDs
2. You may have created a manual customer with similar info
3. Database unique constraint prevents true duplicates

## API Rate Limits

Pipedrive API has rate limits:

- **100 requests per 10 seconds** (per user/token)
- Our sync fetches **100 deals per request** to minimize API calls
- Typical sync uses: `(total_deals / 100) + 1` API requests

**Example:** 500 deals = ~6 API requests, well under limit

## Security Notes

⚠️ **Important:**

- Never commit `.env.local` to git
- Keep your API token secure
- Treat the token like a password
- If token is compromised, regenerate it in Pipedrive immediately

## Next Steps

After successful setup:

1. Test with a small number of deals first
2. Verify customer data looks correct
3. Filter by "Prospects" to see imported deals
4. Create test quotes for prospects
5. Document your workflow for the team

## Support

If you encounter issues:

1. Check server console for detailed errors
2. Verify all environment variables are set correctly
3. Test API token directly in Pipedrive API docs: https://developers.pipedrive.com/docs/api/v1
4. Review the sync job logs in the database (`SyncJob` table)

---

**Integration Created:** January 16, 2026  
**API Version:** Pipedrive API v1  
**Documentation:** https://developers.pipedrive.com/docs/api/v1
