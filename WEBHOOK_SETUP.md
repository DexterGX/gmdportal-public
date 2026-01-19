# Webhook Setup Guide

This guide explains how to set up webhooks for automatic customer syncing from QuickBooks and Pipedrive.

## Overview

Webhooks allow the Customer Directory to update automatically when customers are created or modified in QuickBooks or Pipedrive, without manual syncing.

## QuickBooks Webhooks

### Prerequisites

- QuickBooks Online app created in [QuickBooks Developer Portal](https://developer.intuit.com)
- App deployed to a publicly accessible URL (webhooks don't work on localhost)

### Setup Steps

1. **Generate a Webhook Token**

   ```bash
   # Generate a random secure token
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Add to Environment Variables**
   Add to `.env.local`:

   ```env
   QUICKBOOKS_WEBHOOK_TOKEN=your_generated_token_here
   ```

3. **Configure Webhook in QuickBooks**

   - Go to [QuickBooks Developer Dashboard](https://developer.intuit.com/app/developer/dashboard)
   - Select your app
   - Go to "Webhooks" section
   - Create a new webhook subscription:
     - **Entity**: Customer
     - **Webhook URL**: `https://yourdomain.com/api/quickbooks/webhook`
     - **Verifier Token**: (use the token you generated above)

4. **Verify Setup**
   QuickBooks will send a test POST request to verify the endpoint is working.
   Check your server logs to confirm.

### Events Handled

- **Create**: New customer added to local database
- **Update**: Customer data updated in local database
- **Delete**: Customer marked as inactive in local database

### Documentation

- [QuickBooks Webhooks Documentation](https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks)

---

## Pipedrive Webhooks

### Prerequisites

- Pipedrive account with admin access
- App deployed to a publicly accessible URL

### Setup Steps

1. **(Optional) Generate Webhook Secret**

   ```bash
   # Generate a random secret for security
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **(Optional) Add to Environment Variables**
   Add to `.env.local` (optional but recommended):

   ```env
   PIPEDRIVE_WEBHOOK_SECRET=your_generated_secret_here
   ```

3. **Configure Webhook in Pipedrive**

   - Go to Settings > Webhooks in Pipedrive
   - Click "Create a new webhook"
   - Configure:
     - **Subscription URL**: `https://yourdomain.com/api/pipedrive/webhook`
     - **Events to subscribe to**:
       - ✅ `added.deal`
       - ✅ `updated.deal`
       - ✅ `deleted.deal`
     - **HTTP auth username**: (leave empty)
     - **HTTP auth password**: (leave empty)

4. **Verify Setup**
   - Create a test deal in Pipedrive
   - Check your server logs to confirm webhook was received
   - Check Customer Directory to verify the prospect was added

### Events Handled

- **added.deal**: New deal synced as PROSPECT
- **updated.deal**: Prospect data updated
- **deleted.deal**: Prospect marked as inactive

### Documentation

- [Pipedrive Webhooks Documentation](https://pipedrive.readme.io/docs/webhooks-overview)

---

## Testing Webhooks

### Local Testing with ngrok

For development, use [ngrok](https://ngrok.com/) to expose your local server:

```bash
# Start your Next.js app
npm run dev

# In another terminal, start ngrok
ngrok http 3000
```

Use the ngrok URL (e.g., `https://abc123.ngrok.io`) as your webhook URL during testing.

### Testing QuickBooks Webhook

```bash
# Create a test customer in QuickBooks
# Check server logs:
# [QB Webhook] Create Customer 123 in realm ABC

# Check database to verify customer was added
```

### Testing Pipedrive Webhook

```bash
# Create a test deal in Pipedrive
# Check server logs:
# [Pipedrive Webhook] added.deal - Deal 456

# Check Customer Directory for new prospect
```

---

## Troubleshooting

### QuickBooks Webhook Not Firing

- Verify `QUICKBOOKS_WEBHOOK_TOKEN` is set correctly
- Check QuickBooks Developer Dashboard for webhook status
- Ensure webhook URL is publicly accessible (not localhost)
- Check server logs for signature verification errors

### Pipedrive Webhook Not Firing

- Verify webhook is enabled in Pipedrive settings
- Check subscription URL is correct
- Ensure only deal events are subscribed (not person/org events)
- Check server logs for parsing errors

### Webhook Endpoint Returns 401/500

- Check environment variables are set
- Verify webhook signature/token matches
- Review server logs for detailed error messages

### Customer Not Syncing

- Check that the customer exists in QuickBooks/Pipedrive
- Verify webhook payload includes all required fields
- Check for database connection issues
- Review error logs for sync failures

---

## Security Considerations

1. **Always verify webhook signatures**

   - QuickBooks: HMAC-SHA256 signature verification
   - Pipedrive: Optional secret verification

2. **Use HTTPS in production**

   - Webhooks should only be sent over HTTPS
   - Never expose webhook tokens in client-side code

3. **Rate limiting**

   - Consider adding rate limiting to webhook endpoints
   - Prevent abuse from malicious requests

4. **Log webhook activity**
   - Monitor webhook logs for suspicious activity
   - Set up alerts for failed webhook processing

---

## Next Steps

After setting up webhooks:

1. ✅ Test by creating a customer in QuickBooks
2. ✅ Test by creating a deal in Pipedrive
3. ✅ Verify Customer Directory updates automatically
4. ✅ Monitor webhook logs for any errors
5. ✅ Set up production monitoring/alerting
