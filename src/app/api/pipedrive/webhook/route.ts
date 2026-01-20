import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  mapPipedriveDealToCustomer,
  PipedriveDeal,
  fetchPerson,
  fetchOrganization,
  fetchUser,
} from "@/lib/pipedrive";

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
    action:
      | "added"
      | "updated"
      | "deleted"
      | "delete"
      | "merged"
      | "change"
      | "create";
    entity: "deal" | "person" | "organization";
    entity_id: string;
    company_id: string;
    user_id: string;
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
  secret?: string,
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
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload: any = await request.json();

    console.log(
      "[Pipedrive Webhook] Full payload:",
      JSON.stringify(payload, null, 2),
    );

    console.log(
      `[Pipedrive Webhook] Received webhook for ${payload.meta?.entity} - ${payload.meta?.action}`,
    );

    const { data, previous, meta } = payload;

    // Only process deal events
    if (!meta || meta.entity !== "deal") {
      console.log(
        `[Pipedrive Webhook] Skipping non-deal event: ${
          meta?.entity || "unknown"
        }`,
      );
      return NextResponse.json({ success: true, message: "Not a deal event" });
    }

    try {
      if (meta.action === "deleted" || meta.action === "delete") {
        console.log(
          `[Pipedrive Webhook] Processing delete for Deal ID ${meta.entity_id}`,
        );
        // Mark customer as inactive
        await prisma.customer.updateMany({
          where: { pipedriveId: meta.entity_id.toString() },
          data: { active: false },
        });
        console.log(
          `[Pipedrive Webhook] Marked deal ${meta.entity_id} as inactive`,
        );
      } else if (
        meta.action === "added" ||
        meta.action === "updated" ||
        meta.action === "change" ||
        meta.action === "create"
      ) {
        console.log(
          `[Pipedrive Webhook] Processing ${meta.action} - Deal ${data.id}: ${data.title}`,
        );
        console.log(
          `[Pipedrive Webhook] Owner ID from payload:`,
          data.owner_id,
        );
        console.log(
          `[Pipedrive Webhook] Creator User ID:`,
          data.creator_user_id,
        );

        // Fetch enriched person and organization data from Pipedrive API
        let personData = null;
        let orgData = null;
        let ownerData = null;

        if (data.person_id) {
          const personId =
            typeof data.person_id === "object"
              ? data.person_id.value
              : data.person_id;
          console.log(
            `[Pipedrive Webhook] Fetching person data for ID ${personId}`,
          );
          personData = await fetchPerson(personId);
        }

        if (data.org_id) {
          const orgId =
            typeof data.org_id === "object" ? data.org_id.value : data.org_id;
          console.log(
            `[Pipedrive Webhook] Fetching organization data for ID ${orgId}`,
          );
          orgData = await fetchOrganization(orgId);
        }

        // Get owner ID - it's usually just a number in the webhook
        const ownerId = data.owner_id || data.creator_user_id;
        if (ownerId) {
          const ownerIdNum =
            typeof ownerId === "object" ? ownerId.value || ownerId.id : ownerId;
          console.log(
            `[Pipedrive Webhook] Fetching owner/sales person data for ID ${ownerIdNum}`,
          );
          ownerData = await fetchUser(ownerIdNum);
          console.log(`[Pipedrive Webhook] Owner data fetched:`, ownerData);
        } else {
          console.log(`[Pipedrive Webhook] No owner_id found in webhook data`);
        }

        // Extract address from custom_fields (b91459b6b4eceb9a2cfeba8ee74e8f7c0404b0c3 is the address field)
        let addressData = null;
        if (
          data.custom_fields &&
          data.custom_fields["b91459b6b4eceb9a2cfeba8ee74e8f7c0404b0c3"]
        ) {
          const addrField =
            data.custom_fields["b91459b6b4eceb9a2cfeba8ee74e8f7c0404b0c3"];
          if (addrField.formatted_address) {
            addressData = {
              Line1:
                addrField.route && addrField.street_number
                  ? `${addrField.street_number} ${addrField.route}`
                  : addrField.route || "",
              City: addrField.locality || "",
              CountrySubDivisionCode: addrField.admin_area_level_1 || "",
              PostalCode: addrField.postal_code || "",
              Country: addrField.country || "United States",
            };
            console.log(`[Pipedrive Webhook] Extracted address:`, addressData);
          }
        }

        // Map Pipedrive webhook data to PipedriveDeal format with enriched data
        const dealData: PipedriveDeal = {
          id: data.id,
          title: data.title,
          value: data.value,
          currency: data.currency,
          status: data.status,
          stage_id: data.stage_id,
          person_id: personData
            ? {
                value: personData.id,
                name: personData.name,
                email: personData.email,
                phone: personData.phone,
              }
            : data.person_id,
          org_id: orgData
            ? {
                value: orgData.id,
                name: orgData.name,
              }
            : data.org_id,
          add_time: data.add_time,
          update_time: data.update_time,
          close_time: data.close_time,
          won_time: data.won_time,
          lost_time: data.lost_time,
          expected_close_date: data.expected_close_date,
        };

        // Get person_id for customer lookup
        const personId =
          personData?.id?.toString() ||
          (typeof data.person_id === "object"
            ? data.person_id.value?.toString()
            : data.person_id?.toString());

        // Sync the deal
        console.log(
          `[Pipedrive Webhook] Mapping deal data for ${dealData.title}`,
        );
        const customerData = mapPipedriveDealToCustomer(dealData);

        // Use person_id as the customer identifier (not deal_id)
        if (personId) {
          customerData.pipedriveId = personId;
        }

        console.log(`[Pipedrive Webhook] Customer data:`, {
          pipedriveId: customerData.pipedriveId,
          displayName: customerData.displayName,
          type: customerData.type,
          email: customerData.email,
          phone: customerData.phone,
        });

        // Add address if extracted from custom fields
        if (addressData) {
          (customerData as any).billAddr = addressData;
          (customerData as any).shipAddr = addressData;
        }

        // Add sales person if available
        if (ownerData) {
          (customerData as any).salesPerson = ownerData.name;
        }

        // Use Pipedrive timestamps for accurate dates
        const customerCreatedAt = data.add_time
          ? new Date(data.add_time)
          : new Date();
        const customerUpdatedAt = data.update_time
          ? new Date(data.update_time)
          : new Date();

        // Use upsert to handle race conditions from multiple webhooks
        const customer = await prisma.customer.upsert({
          where: { pipedriveId: customerData.pipedriveId },
          update: {
            ...customerData,
            pipedriveData: JSON.parse(
              JSON.stringify(customerData.pipedriveData),
            ),
            billAddr: addressData || (customerData as any).billAddr,
            shipAddr: addressData || (customerData as any).shipAddr,
            salesPerson: ownerData?.name || (customerData as any).salesPerson,
            updatedAt: customerUpdatedAt,
          },
          create: {
            ...customerData,
            pipedriveData: JSON.parse(
              JSON.stringify(customerData.pipedriveData),
            ),
            billAddr: addressData || undefined,
            shipAddr: addressData || undefined,
            salesPerson: ownerData?.name,
            createdAt: customerCreatedAt,
            updatedAt: customerUpdatedAt,
          },
        });

        console.log(
          `[Pipedrive Webhook] ✓ Synced customer ${customer.id} (person ${customerData.pipedriveId})`,
        );

        // Create/update Job record for this specific deal
        const dealCreatedAt = data.add_time
          ? new Date(data.add_time)
          : new Date();
        const dealUpdatedAt = data.update_time
          ? new Date(data.update_time)
          : new Date();

        await prisma.job.upsert({
          where: {
            pipedriveId: data.id.toString(),
          },
          update: {
            jobName: data.title,
            value: data.value,
            status:
              data.status === "won"
                ? "COMPLETE"
                : data.status === "lost"
                  ? "CANCELLED"
                  : "ONGOING",
            updatedAt: dealUpdatedAt,
            lastSyncedAt: new Date(),
          },
          create: {
            customerId: customer.id,
            jobName: data.title,
            pipedriveId: data.id.toString(),
            value: data.value,
            status:
              data.status === "won"
                ? "COMPLETE"
                : data.status === "lost"
                  ? "CANCELLED"
                  : "ONGOING",
            createdAt: dealCreatedAt,
            updatedAt: dealUpdatedAt,
            lastSyncedAt: new Date(),
          },
        });

        console.log(
          `[Pipedrive Webhook] ✓ Synced job ${data.id}: ${data.title}`,
        );
      }

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error(
        `[Pipedrive Webhook] ✗ Failed to process ${meta.action} for deal ${meta.entity_id}:`,
        error,
      );
      console.error(
        `[Pipedrive Webhook] Error details:`,
        error.message,
        error.stack,
      );
      // Return 200 to prevent Pipedrive from retrying
      return NextResponse.json(
        { success: false, error: error.message || "Processing failed" },
        { status: 200 },
      );
    }
  } catch (error: any) {
    console.error("Pipedrive webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 },
    );
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "ok" });
}
