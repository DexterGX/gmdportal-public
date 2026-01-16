# QuickBooks Auto-Refresh Token Setup

Your QuickBooks integration now has **automatic token refresh** - you'll never need to manually update tokens every hour again!

## Initial One-Time Setup

1. **Get your tokens from QuickBooks OAuth Playground:**

   - Go to: https://developer.intuit.com/app/developer/playground
   - Click "Get app now" and create an app if you haven't
   - Use OAuth Playground to get:
     - Access Token
     - Refresh Token
     - Realm ID (Company ID)

2. **Configure tokens in your app:**

   - Go to `/customers/sync` in your app
   - Click "Configure Tokens"
   - Paste your Access Token, Refresh Token, and Realm ID
   - Click "Save Tokens"

3. **Done!**
   - Tokens are stored in your database
   - They will automatically refresh when needed (every ~1 hour)
   - You never need to update them manually again

## How It Works

- **Access tokens expire after 1 hour** (QuickBooks limitation)
- **Refresh tokens are valid for 100 days**
- The system automatically:
  - Checks if the token will expire in the next 5 minutes
  - Refreshes it using the refresh token
  - Saves the new tokens to the database
  - Updates the refresh token (which resets the 100-day clock)

As long as you sync at least once every 100 days, your tokens will stay valid **forever** through automatic refresh!

## Token Status

Visit `/customers/sync` to see:

- Connection status
- Time until token expiry
- Last refresh time
- Update tokens if needed

## Migration from .env.local

If you have tokens in `.env.local`, they'll still work as a fallback, but it's recommended to:

1. Copy the tokens from `.env.local`
2. Save them via the `/customers/sync` page
3. Then remove them from `.env.local` (optional, but cleaner)

The system will use database tokens first, then fall back to environment variables.

## Environment Variables Still Needed

Keep these in `.env.local` (used for OAuth refresh):

```
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_ENVIRONMENT=sandbox  # or "production"
```

You can remove these (now stored in database):

- ~~QUICKBOOKS_ACCESS_TOKEN~~ → Stored in DB
- ~~QUICKBOOKS_REFRESH_TOKEN~~ → Stored in DB
- ~~QUICKBOOKS_REALM_ID~~ → Stored in DB
