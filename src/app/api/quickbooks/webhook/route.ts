import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { syncCustomerFromQuickBooks } from "@/lib/quickbooks";

/**
 * QuickBooks Webhook Handler
 *
 * Receives notifications when Customer entities change in QuickBooks.
 * Automatically syncs the changed customer to the local database.
 *
 * Setup:
 * 1. In QuickBooks Developer Dashboard, create a webhook subscription for Customer entity
 * 2. Set webhook URL to: https://yourdomain.com/api/quickbooks/webhook
 * 3. Add QUICKBOOKS_WEBHOOK_TOKEN to .env.local
 *
 * Docs: https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
 */

interface QuickBooksWebhookPayload {
  eventNotifications: Array<{
    realmId: string;
    dataChangeEvent: {
      entities: Array<{
        name: string; // "Customer"
        id: string;
        operation: "Create" | "Update" | "Delete" | "Merge";
        lastUpdated: string;
      }>;
    };
  }>;
}

/**
 * Verify QuickBooks webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookToken: string
): boolean {
  const hash = crypto
    .createHmac("sha256", webhookToken)
    .update(payload)
    .digest("base64");
  return hash === signature;
}

/**
 * POST handler for QuickBooks webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const webhookToken = process.env.QUICKBOOKS_WEBHOOK_TOKEN;

    if (!webhookToken) {
      console.error("QUICKBOOKS_WEBHOOK_TOKEN not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("intuit-signature");

    if (!signature) {
      console.error("Missing webhook signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature, webhookToken)) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse payload
    const payload: QuickBooksWebhookPayload = JSON.parse(rawBody);

    // Process each notification
    for (const notification of payload.eventNotifications) {
      const { realmId, dataChangeEvent } = notification;

      for (const entity of dataChangeEvent.entities) {
        // Only process Customer entities
        if (entity.name !== "Customer") {
          continue;
        }

        const { id, operation } = entity;

        console.log(
          `[QB Webhook] ${operation} Customer ${id} in realm ${realmId}`
        );

        try {
          if (operation === "Delete") {
            // Mark customer as inactive or delete
            await prisma.customer.updateMany({
              where: { quickbooksId: id },
              data: { active: false },
            });
          } else if (operation === "Create" || operation === "Update") {
            // Sync the specific customer from QuickBooks
            await syncCustomerFromQuickBooks(id);
          }
        } catch (error) {
          console.error(
            `Failed to process ${operation} for customer ${id}:`,
            error
          );
          // Continue processing other entities even if one fails
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("QuickBooks webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * GET handler for webhook verification (QuickBooks pings this to verify URL)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "ok" });
}
