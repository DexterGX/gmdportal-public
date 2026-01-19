import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import {
  fetchAllQuickBooksCustomers,
  mapQuickBooksCustomerToDb,
  extractJobName,
} from "@/lib/quickbooks";

/**
 * QuickBooks Customer Sync - READ-ONLY Operation
 *
 * ⚠️ IMPORTANT: This endpoint only READS from QuickBooks.
 * It NEVER creates, updates, or deletes any QuickBooks records.
 *
 * Process:
 * 1. Fetches customer data from QuickBooks (READ-ONLY)
 * 2. Saves/updates customers in LOCAL database only
 * 3. QuickBooks data remains completely unchanged
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
      let syncJob;
      try {
        // Create sync job record
        syncJob = await prisma.syncJob.create({
          data: {
            type: "customer_sync",
            status: "running",
          },
        });

        await sendProgress({
          stage: "fetching",
          message: "Fetching customers from QuickBooks...",
          jobId: syncJob.id,
        });

        // Fetch ALL customers from QuickBooks (handles pagination automatically)
        const qbCustomers = await fetchAllQuickBooksCustomers();

        // Update total records
        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: { totalRecords: qbCustomers.length },
        });

        await sendProgress({
          stage: "processing",
          message: `Processing ${qbCustomers.length} customers...`,
          total: qbCustomers.length,
          jobId: syncJob.id,
        });

        let created = 0;
        let updated = 0;
        let errors = 0;
        let jobsCreated = 0;
        let jobsUpdated = 0;

        // Separate parent customers from job sub-accounts
        const parentCustomers = qbCustomers.filter((c) => !c.Job && !c.ParentRef);
        const jobSubAccounts = qbCustomers.filter((c) => c.Job || c.ParentRef);

        console.log(`[Sync] Found ${parentCustomers.length} parent customers and ${jobSubAccounts.length} job sub-accounts`);

        // Get all existing QuickBooks IDs from database in one query
        const existingCustomers = await prisma.customer.findMany({
          where: {
            quickbooksId: {
              in: parentCustomers.map((c) => c.Id).filter(Boolean),
            },
          },
          select: {
            id: true,
            quickbooksId: true,
          },
        });

        const existingQbIds = new Set(
          existingCustomers.map((c) => c.quickbooksId)
        );
        const existingMap = new Map(
          existingCustomers.map((c) => [c.quickbooksId, c.id])
        );

        // Separate into new vs existing (PARENT CUSTOMERS ONLY)
        const newCustomers = [];
        const updateCustomers = [];

        for (const qbCustomer of parentCustomers) {
          try {
            const customerData = mapQuickBooksCustomerToDb(qbCustomer);

            if (existingQbIds.has(qbCustomer.Id)) {
              updateCustomers.push({
                id: existingMap.get(qbCustomer.Id)!,
                data: customerData,
              });
            } else {
              newCustomers.push(customerData);
            }
          } catch (error) {
            console.error(`Failed to map customer ${qbCustomer.Id}:`, error);
            errors++;
          }
        }

        // Batch create new customers (much faster)
        if (newCustomers.length > 0) {
          await sendProgress({
            stage: "creating",
            message: `Creating ${newCustomers.length} new customers...`,
            processed: 0,
            total: qbCustomers.length,
          });

          const result = await prisma.customer.createMany({
            data: newCustomers,
            skipDuplicates: true,
          });
          created = result.count;

          await sendProgress({
            stage: "creating",
            message: `Created ${created} customers`,
            processed: created,
            total: qbCustomers.length,
          });
        }

        // Batch update existing customers (process in parallel batches for speed)
        let processedUpdates = 0;
        const batchSize = 40; // Optimized batch size for connection pool limit of 15
        console.log(
          `[Connection Monitor] Starting batch updates with batchSize=${batchSize}, connection_limit=15`
        );

        for (let i = 0; i < updateCustomers.length; i += batchSize) {
          // Check if cancellation was requested (only every 500 customers for performance)
          if (processedUpdates % 500 === 0 && processedUpdates > 0) {
            const jobStatus = await prisma.syncJob.findUnique({
              where: { id: syncJob.id },
              select: { cancelRequested: true },
            });

            if (jobStatus?.cancelRequested) {
              await prisma.syncJob.update({
                where: { id: syncJob.id },
                data: {
                  status: "cancelled",
                  cancelledAt: new Date(),
                  processedRecords: created + processedUpdates,
                  createdRecords: created,
                  updatedRecords: processedUpdates,
                  errorCount: errors,
                },
              });
              await sendProgress({
                stage: "cancelled",
                message: "Sync cancelled by user",
                stats: {
                  total: qbCustomers.length,
                  created,
                  updated: processedUpdates,
                  errors,
                },
              });
              return;
            }
          }

          const batch = updateCustomers.slice(i, i + batchSize);
          const batchStartTime = Date.now();

          await Promise.all(
            batch.map(({ id, data }) =>
              prisma.customer
                .update({
                  where: { id },
                  data,
                })
                .catch((error) => {
                  console.error(`Failed to update customer ${id}:`, error);
                  errors++;
                })
            )
          );

          const batchDuration = Date.now() - batchStartTime;
          processedUpdates += batch.length;

          // Log batch performance every 500 customers
          if (
            processedUpdates % 500 === 0 ||
            processedUpdates === updateCustomers.length
          ) {
            console.log(
              `[Connection Monitor] Batch completed: ${
                batch.length
              } customers in ${batchDuration}ms (avg ${(
                batchDuration / batch.length
              ).toFixed(
                1
              )}ms per customer) | Total progress: ${processedUpdates}/${
                updateCustomers.length
              }`
            );
          }
          updated = processedUpdates;

          // Send progress update every 500 customers (less overhead)
          if (
            processedUpdates % 500 === 0 ||
            processedUpdates === updateCustomers.length
          ) {
            await prisma.syncJob.update({
              where: { id: syncJob.id },
              data: {
                processedRecords: created + processedUpdates,
                createdRecords: created,
                updatedRecords: processedUpdates,
                errorCount: errors,
              },
            });
            await sendProgress({
              stage: "updating",
              message: `Updating customers (${processedUpdates}/${updateCustomers.length})...`,
              processed: created + processedUpdates,
              total: qbCustomers.length,
              jobId: syncJob.id,
            });
          }
        }

        // Now process job sub-accounts
        await sendProgress({
          stage: "jobs",
          message: `Processing ${jobSubAccounts.length} job sub-accounts...`,
          processed: created + updated,
          total: qbCustomers.length,
          jobId: syncJob.id,
        });

        // Get all customers again to have complete ID mapping including newly created
        const allCustomers = await prisma.customer.findMany({
          where: {
            quickbooksId: { not: null },
          },
          select: {
            id: true,
            quickbooksId: true,
          },
        });
        const customerIdMap = new Map(allCustomers.map((c) => [c.quickbooksId, c.id]));

        // Get existing jobs
        const existingJobs = await prisma.job.findMany({
          where: {
            quickbooksJobId: {
              in: jobSubAccounts.map((j) => j.Id).filter(Boolean),
            },
          },
          select: {
            id: true,
            quickbooksJobId: true,
          },
        });
        const existingJobIds = new Set(existingJobs.map((j) => j.quickbooksJobId));

        // Process job sub-accounts
        for (const jobAccount of jobSubAccounts) {
          try {
            if (!jobAccount.ParentRef?.value) {
              console.warn(`Job ${jobAccount.Id} has no parent reference, skipping`);
              continue;
            }

            const parentCustomerId = customerIdMap.get(jobAccount.ParentRef.value);
            if (!parentCustomerId) {
              console.warn(`Parent customer ${jobAccount.ParentRef.value} not found for job ${jobAccount.Id}`);
              errors++;
              continue;
            }

            const parentName = jobAccount.ParentRef.name || '';
            const jobName = extractJobName(jobAccount.DisplayName, parentName);

            const jobData = {
              customerId: parentCustomerId,
              jobName,
              quickbooksJobId: jobAccount.Id,
              status: jobAccount.Active ? 'ONGOING' as const : 'COMPLETE' as const,
              value: jobAccount.Balance || 0,
              lastSyncedAt: new Date(),
            };

            if (existingJobIds.has(jobAccount.Id)) {
              // Update existing job
              await prisma.job.updateMany({
                where: { quickbooksJobId: jobAccount.Id },
                data: jobData,
              });
              jobsUpdated++;
            } else {
              // Create new job
              await prisma.job.create({
                data: jobData,
              });
              jobsCreated++;
            }
          } catch (error) {
            console.error(`Failed to process job ${jobAccount.Id}:`, error);
            errors++;
          }
        }

        console.log(`[Sync] Jobs: ${jobsCreated} created, ${jobsUpdated} updated`);

        // Update sync job as completed
        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            processedRecords: qbCustomers.length,
            createdRecords: created,
            updatedRecords: updated,
            errorCount: errors,
          },
        });

        // Send final completion
        await sendProgress({
          stage: "complete",
          message: "Sync completed successfully!",
          jobId: syncJob.id,
          stats: {
            total: qbCustomers.length,
            created,
            updated,
            jobsCreated,
            jobsUpdated,
            errors,
          },
        });
      } catch (error: any) {
        console.error("QuickBooks sync error:", error);

        // Update sync job as failed
        if (syncJob) {
          await prisma.syncJob.update({
            where: { id: syncJob.id },
            data: {
              status: "failed",
              completedAt: new Date(),
              errorMessage: error.message,
            },
          });
        }

        await sendProgress({
          stage: "error",
          message: error.message || "Failed to sync customers from QuickBooks",
        });
      } finally {
        await writer.close();
      }
    })();

    // Return the stream as Server-Sent Events
    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("QuickBooks sync error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync customers from QuickBooks" },
      { status: 500 }
    );
  }
}
