import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import {
  fetchAllDeals,
  mapPipedriveDealToCustomer,
  testConnection,
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
          error:
            "Failed to connect to Pipedrive. Check your API credentials.",
        },
        { status: 500 }
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

        // Get all existing Pipedrive IDs from database
        const existingCustomers = await prisma.customer.findMany({
          where: {
            pipedriveId: {
              in: deals.map((d) => d.id.toString()).filter(Boolean),
            },
          },
          select: {
            id: true,
            pipedriveId: true,
          },
        });

        const existingPipedriveIds = new Set(
          existingCustomers.map((c) => c.pipedriveId)
        );
        const existingMap = new Map(
          existingCustomers.map((c) => [c.pipedriveId, c.id])
        );

        // Process in batches for better performance
        const batchSize = 50;
        const batches = [];
        for (let i = 0; i < deals.length; i += batchSize) {
          batches.push(deals.slice(i, i + batchSize));
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

          // Separate new vs existing in this batch
          const newCustomers = [];
          const updateOperations = [];

          for (const deal of batch) {
            try {
              const customerData = mapPipedriveDealToCustomer(deal);

              if (existingPipedriveIds.has(customerData.pipedriveId)) {
                updateOperations.push({
                  id: existingMap.get(customerData.pipedriveId)!,
                  data: customerData,
                });
              } else {
                newCustomers.push(customerData);
              }
            } catch (error) {
              console.error(`Failed to map deal ${deal.id}:`, error);
              errors++;
            }
          }

          // Batch create new customers
          if (newCustomers.length > 0) {
            try {
              const result = await prisma.customer.createMany({
                data: newCustomers.map(c => ({
                  ...c,
                  pipedriveData: JSON.parse(JSON.stringify(c.pipedriveData)),
                })),
                skipDuplicates: true,
              });
              created += result.count;
            } catch (error) {
              console.error("Batch create error:", error);
              errors += newCustomers.length;
            }
          }

          // Batch update existing customers
          if (updateOperations.length > 0) {
            try {
              await prisma.$transaction(
                updateOperations.map((op) =>
                  prisma.customer.update({
                    where: { id: op.id },
                    data: {
                      ...op.data,
                      pipedriveData: JSON.parse(JSON.stringify(op.data.pipedriveData)),
                      updatedAt: new Date(),
                    },
                  })
                )
              );
              updated += updateOperations.length;
            } catch (error) {
              console.error("Batch update error:", error);
              errors += updateOperations.length;
            }
          }

          processed += batch.length;
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
            `[Pipedrive Sync] Batch ${batchIndex + 1}/${batches.length}: ${batch.length} deals in ${batchTime}ms (Created: ${newCustomers.length}, Updated: ${updateOperations.length})`
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
      { status: 500 }
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

      return NextResponse.json({ success: true, message: "Cancellation requested" });
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
      { status: 500 }
    );
  }
}
