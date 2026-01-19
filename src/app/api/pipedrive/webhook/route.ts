import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapPipedriveDealToCustomer, PipedriveDeal } from "@/lib/pipedrive";

/**
 * Pipedrive Webhook Handler
 * 
 * Receives notifications when deals change in Pipedrive.
 * Automatically syncs the changed deal to the local database as a PROSPECT.
 * 
 * Setup:
 * 1. In Pipedrive Settings > Webhooks, create a new webhook
 * 2. Set URL to: https://yourdomain.com/api/pipedrive/webhook
 * 3. Subscribe to these events:
 *    - added.deal
 *    - updated.deal
 *    - deleted.deal
 * 4. Optional: Add PIPEDRIVE_WEBHOOK_SECRET to .env.local for security
 * 
 * Docs: https://pipedrive.readme.io/docs/webhooks-overview
 */

interface PipedriveWebhookPayload {
  v: number;
  matches_filters: {
    current: number[];
    previous: number[];
  };
  meta: {
    action: "added" | "updated" | "deleted" | "merged";
    object: "deal" | "person" | "organization";
    id: number;
    company_id: number;
    user_id: number;
    host: string;
    timestamp: number;
    timestamp_micro: number;
    permitted_user_ids: number[];
    trans_pending: boolean;
    is_bulk_update: boolean;
    pipedrive_service_name: boolean;
    webhook_id: string;
  };
  current: PipedriveDeal | null;
  previous: PipedriveDeal | null;
  event: string; // "added.deal", "updated.deal", "deleted.deal"
}

/**
 * Verify Pipedrive webhook (optional but recommended)
 */
function verifyPipedriveWebhook(
  request: NextRequest,
  secret?: string
): boolean {
  if (!secret) {
    // If no secret configured, allow all webhooks
    return true;
  }

  const signature = request.headers.get("x-pipedrive-signature");
  // Implement signature verification if Pipedrive provides it
  // For now, we'll use a simple secret check
  return signature === secret;
}

/**
 * POST handler for Pipedrive webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.PIPEDRIVE_WEBHOOK_SECRET;

    // Optional signature verification
    if (webhookSecret && !verifyPipedriveWebhook(request, webhookSecret)) {
      console.error("Invalid Pipedrive webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload: any = await request.json();
    
    console.log(`[Pipedrive Webhook] Received webhook for ${payload.meta?.entity} - ${payload.meta?.action}`);

    const { data, previous, meta } = payload;

    // Only process deal events
    if (!meta || meta.entity !== "deal") {
      console.log(`[Pipedrive Webhook] Skipping non-deal event: ${meta?.entity || 'unknown'}`);
      return NextResponse.json({ success: true, message: "Not a deal event" });
    }

    console.log(`[Pipedrive Webhook] Processing ${meta.action} - Deal ${data.id}: ${data.title}`);

    try {
      if (meta.action === "deleted") {
        // Mark customer as inactive
        await prisma.customer.updateMany({
          where: { pipedriveId: meta.id.toString() },
          data: { active: false },
        });
        console.log(`[Pipedrive Webhook] Marked deal ${meta.id} as inactive`);
      } else if (meta.action === "added" || meta.action === "updated" || meta.action === "change") {
        // Map Pipedrive webhook data to PipedriveDeal format
        const dealData: PipedriveDeal = {
          id: data.id,
          title: data.title,
          value: data.value,
          currency: data.currency,
          status: data.status,
          stage_id: data.stage_id,
          person_id: data.person_id,
          org_id: data.org_id,
          add_time: data.add_time,
          update_time: data.update_time,
          close_time: data.close_time,
          won_time: data.won_time,
          lost_time: data.lost_time,
          expected_close_date: data.expected_close_date,
        };

        // Sync the deal
        console.log(`[Pipedrive Webhook] Mapping deal data for ${dealData.title}`);
        const customerData = mapPipedriveDealToCustomer(dealData);
        console.log(`[Pipedrive Webhook] Customer data:`, {
          pipedriveId: customerData.pipedriveId,
          displayName: customerData.displayName,
          type: customerData.type
        });

        // Check if customer already exists
        const existing = await prisma.customer.findUnique({
          where: { pipedriveId: customerData.pipedriveId },
        });

        if (existing) {
          // Update existing customer
          console.log(`[Pipedrive Webhook] Updating existing customer ${existing.id}`);
          await prisma.customer.update({
            where: { pipedriveId: customerData.pipedriveId },
            data: {
              ...customerData,
              pipedriveData: JSON.parse(JSON.stringify(customerData.pipedriveData)),
              updatedAt: new Date(),
            },
          });
          console.log(`[Pipedrive Webhook] ✓ Updated deal ${data.id}`);
        } else {
          // Create new customer
          console.log(`[Pipedrive Webhook] Creating new customer`);
          const newCustomer = await prisma.customer.create({
            data: {
              ...customerData,
              pipedriveData: JSON.parse(JSON.stringify(customerData.pipedriveData)),
            },
          });
          console.log(`[Pipedrive Webhook] ✓ Created new customer ${newCustomer.id} from deal ${data.id}`);
        }
      }

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error(
        `[Pipedrive Webhook] ✗ Failed to process ${meta.action} for deal ${data.id}:`,
        error
      );
      console.error(`[Pipedrive Webhook] Error details:`, error.message, error.stack);
      // Return 200 to prevent Pipedrive from retrying
      return NextResponse.json(
        { success: false, error: error.message || "Processing failed" },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error("Pipedrive webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "ok" });
}
