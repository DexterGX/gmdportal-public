import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import {
  fetchAllDeals,
  mapPipedriveDealToCustomer,
  testConnection,
  fetchPerson,
  fetchOrganization,
  fetchUser,
} from "@/lib/pipedrive";

/**
 * Pipedrive Deal Sync
 *
 * This endpoint syncs deals from Pipedrive to the local database as PROSPECTS.
 * Only deals are synced (not persons directly, though person data comes with deals).
 *
 * Process:
 * 1. Fetches all deals from Pipedrive
 * 2. Creates/updates Customer records with type=PROSPECT
 * 3. Stores full Pipedrive data in pipedriveData JSON field
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check - admin only
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Test Pipedrive connection first
    const connectionOk = await testConnection();
    if (!connectionOk) {
      return NextResponse.json(
        {
          error: "Failed to connect to Pipedrive. Check your API credentials.",
        },
        { status: 500 },
      );
    }

    // Create a TransformStream for streaming progress updates
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Helper to send progress updates
    const sendProgress = async (data: any) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    // Start the sync process in the background
    (async () => {
      let syncJob: { id: string } | undefined;
      try {
        // Create sync job record
        syncJob = await prisma.syncJob.create({
          data: {
            type: "pipedrive_sync",
            status: "running",
          },
        });

        await sendProgress({
          stage: "fetching",
          message: "Fetching deals from Pipedrive...",
          jobId: syncJob.id,
        });

        // Fetch ALL deals from Pipedrive (only open/won, not lost/deleted)
        const deals = await fetchAllDeals("all_not_deleted");

        // Update total records
        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: { totalRecords: deals.length },
        });

        await sendProgress({
          stage: "processing",
          message: `Processing ${deals.length} deals...`,
          total: deals.length,
          jobId: syncJob.id,
        });

        let created = 0;
        let updated = 0;
        let errors = 0;
        let processed = 0;

        // Group deals by person_id to avoid duplicates
        const dealsByPerson = new Map<string, any[]>();

        for (const deal of deals) {
          const personId = deal.person_id
            ? typeof deal.person_id === "object"
              ? deal.person_id.value?.toString()
              : deal.person_id.toString()
            : `deal_${deal.id}`; // Fallback for deals without person

          if (!dealsByPerson.has(personId)) {
            dealsByPerson.set(personId, []);
          }
          dealsByPerson.get(personId)!.push(deal);
        }

        console.log(
          `[Pipedrive Sync] Grouped ${deals.length} deals into ${dealsByPerson.size} unique customers`,
        );

        // Get all existing Pipedrive IDs from database
        const existingCustomers = await prisma.customer.findMany({
          where: {
            pipedriveId: {
              in: Array.from(dealsByPerson.keys()).filter(Boolean),
            },
          },
          select: {
            id: true,
            pipedriveId: true,
          },
        });

        const existingPipedriveIds = new Set(
          existingCustomers.map((c) => c.pipedriveId),
        );
        const existingMap = new Map(
          existingCustomers.map((c) => [c.pipedriveId, c.id]),
        );

        // Process in batches for better performance
        const batchSize = 20; // Reduced batch size due to API calls
        const personEntries = Array.from(dealsByPerson.entries());
        const batches = [];
        for (let i = 0; i < personEntries.length; i += batchSize) {
          batches.push(personEntries.slice(i, i + batchSize));
        }

        // Check for cancellation
        const checkCancellation = async () => {
          if (!syncJob) return false;
          const job = await prisma.syncJob.findUnique({
            where: { id: syncJob.id },
            select: { cancelRequested: true },
          });
          return job?.cancelRequested || false;
        };

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          // Check if cancellation was requested
          if (await checkCancellation()) {
            await prisma.syncJob.update({
              where: { id: syncJob.id },
              data: {
                status: "cancelled",
                cancelledAt: new Date(),
                processedRecords: processed,
                createdRecords: created,
                updatedRecords: updated,
                errorCount: errors,
              },
            });

            await sendProgress({
              stage: "cancelled",
              message: "Sync cancelled by user",
              processed,
              total: deals.length,
              created,
              updated,
              errors,
            });

            await writer.close();
            return;
          }

          const batch = batches[batchIndex];
          const batchStartTime = Date.now();

          for (const [personId, personDeals] of batch) {
            try {
              // Use the first deal as the primary source for customer data
              const primaryDeal = personDeals[0];

              // Fetch enriched person, organization, and owner data
              let personData = null;
              let orgData = null;
              let ownerData = null;

              if (primaryDeal.person_id) {
                const pId =
                  typeof primaryDeal.person_id === "object"
                    ? primaryDeal.person_id.value
                    : primaryDeal.person_id;
                personData = await fetchPerson(pId);
              }

              if (primaryDeal.org_id) {
                const orgId =
                  typeof primaryDeal.org_id === "object"
                    ? primaryDeal.org_id.value
                    : primaryDeal.org_id;
                orgData = await fetchOrganization(orgId);
              }

              const ownerId =
                (primaryDeal as any).owner_id ||
                (primaryDeal as any).creator_user_id;
              if (ownerId) {
                const ownerIdNum =
                  typeof ownerId === "object"
                    ? ownerId.value || ownerId.id
                    : ownerId;
                ownerData = await fetchUser(ownerIdNum);
              }

              // Enrich deal data with fetched information
              const enrichedDeal = {
                ...primaryDeal,
                person_id: personData
                  ? {
                      value: personData.id,
                      name: personData.name,
                      email: personData.email,
                      phone: personData.phone,
                    }
                  : primaryDeal.person_id,
                org_id: orgData
                  ? {
                      value: orgData.id,
                      name: orgData.name,
                    }
                  : primaryDeal.org_id,
              };

              const customerData = mapPipedriveDealToCustomer(enrichedDeal);

              // Use person_id as the unique identifier instead of deal_id
              customerData.pipedriveId = personId;

              // Extract address from custom_fields if available
              if (
                (primaryDeal as any).custom_fields &&
                (primaryDeal as any).custom_fields[
                  "b91459b6b4eceb9a2cfeba8ee74e8f7c0404b0c3"
                ]
              ) {
                const addrField = (primaryDeal as any).custom_fields[
                  "b91459b6b4eceb9a2cfeba8ee74e8f7c0404b0c3"
                ];
                if (addrField.formatted_address) {
                  const addressData = {
                    Line1:
                      addrField.route && addrField.street_number
                        ? `${addrField.street_number} ${addrField.route}`
                        : addrField.route || "",
                    City: addrField.locality || "",
                    CountrySubDivisionCode: addrField.admin_area_level_1 || "",
                    PostalCode: addrField.postal_code || "",
                    Country: addrField.country || "United States",
                  };
                  (customerData as any).billAddr = addressData;
                  (customerData as any).shipAddr = addressData;
                }
              }

              // Add sales person
              if (ownerData) {
                (customerData as any).salesPerson = ownerData.name;
              }

              // Use Pipedrive timestamps for accurate dates
              const customerCreatedAt = primaryDeal.add_time
                ? new Date(primaryDeal.add_time)
                : new Date();
              const customerUpdatedAt = primaryDeal.update_time
                ? new Date(primaryDeal.update_time)
                : new Date();

              // Upsert customer (one per person)
              const customer = await prisma.customer.upsert({
                where: { pipedriveId: personId },
                update: {
                  ...customerData,
                  pipedriveData: JSON.parse(
                    JSON.stringify(customerData.pipedriveData),
                  ),
                  updatedAt: customerUpdatedAt,
                },
                create: {
                  ...customerData,
                  pipedriveData: JSON.parse(
                    JSON.stringify(customerData.pipedriveData),
                  ),
                  createdAt: customerCreatedAt,
                  updatedAt: customerUpdatedAt,
                },
              });

              const isNewCustomer = !existingPipedriveIds.has(personId);
              if (isNewCustomer) {
                created++;
                existingPipedriveIds.add(personId);
              } else {
                updated++;
              }

              // Create/update Job records for each deal
              for (const deal of personDeals) {
                try {
                  // Use Pipedrive's add_time or update_time for accurate dates
                  const dealCreatedAt = deal.add_time
                    ? new Date(deal.add_time)
                    : new Date();
                  const dealUpdatedAt = deal.update_time
                    ? new Date(deal.update_time)
                    : new Date();

                  await prisma.job.upsert({
                    where: {
                      pipedriveId: deal.id.toString(),
                    },
                    update: {
                      jobName: deal.title,
                      value: deal.value,
                      status:
                        deal.status === "won"
                          ? "COMPLETE"
                          : deal.status === "lost"
                            ? "CANCELLED"
                            : "ONGOING",
                      updatedAt: dealUpdatedAt,
                      lastSyncedAt: new Date(),
                    },
                    create: {
                      customerId: customer.id,
                      jobName: deal.title,
                      pipedriveId: deal.id.toString(),
                      value: deal.value,
                      status:
                        deal.status === "won"
                          ? "COMPLETE"
                          : deal.status === "lost"
                            ? "CANCELLED"
                            : "ONGOING",
                      createdAt: dealCreatedAt,
                      updatedAt: dealUpdatedAt,
                      lastSyncedAt: new Date(),
                    },
                  });
                } catch (jobError) {
                  console.error(
                    `Failed to create/update job for deal ${deal.id}:`,
                    jobError,
                  );
                }
              }

              processed++;
            } catch (error) {
              console.error(`Failed to process person ${personId}:`, error);
              errors++;
            }
          }

          const batchTime = Date.now() - batchStartTime;

          // Update sync job progress
          await prisma.syncJob.update({
            where: { id: syncJob.id },
            data: {
              processedRecords: processed,
              createdRecords: created,
              updatedRecords: updated,
              errorCount: errors,
            },
          });

          await sendProgress({
            stage: "processing",
            message: `Processed batch ${batchIndex + 1}/${batches.length}`,
            processed,
            total: deals.length,
            created,
            updated,
            errors,
            batchTime,
          });

          console.log(
            `[Pipedrive Sync] Batch ${batchIndex + 1}/${batches.length}: ${
              batch.length
            } people in ${batchTime}ms`,
          );
        }

        // Mark sync job as complete
        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            processedRecords: processed,
            createdRecords: created,
            updatedRecords: updated,
            errorCount: errors,
          },
        });

        await sendProgress({
          stage: "complete",
          message: "Sync completed successfully",
          processed,
          total: deals.length,
          created,
          updated,
          errors,
        });
      } catch (error: any) {
        console.error("Pipedrive sync error:", error);

        if (syncJob) {
          await prisma.syncJob.update({
            where: { id: syncJob.id },
            data: {
              status: "failed",
              errorMessage: error.message || "Unknown error",
            },
          });
        }

        await sendProgress({
          stage: "error",
          message: error.message || "Sync failed",
          error: error.message,
        });
      } finally {
        await writer.close();
      }
    })();

    // Return the stream immediately
    return new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Pipedrive sync setup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start sync" },
      { status: 500 },
    );
  }
}

/**
 * GET endpoint to check sync status or cancel
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const jobId = searchParams.get("jobId");

    if (action === "cancel" && jobId) {
      // Request cancellation
      const { appRole } = await getCurrentUserWithRole();
      if (appRole !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await prisma.syncJob.update({
        where: { id: jobId },
        data: { cancelRequested: true },
      });

      return NextResponse.json({
        success: true,
        message: "Cancellation requested",
      });
    }

    // Get latest sync job
    const latestJob = await prisma.syncJob.findFirst({
      where: { type: "pipedrive_sync" },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json({ job: latestJob });
  } catch (error: any) {
    console.error("Pipedrive sync GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get sync status" },
      { status: 500 },
    );
  }
}
