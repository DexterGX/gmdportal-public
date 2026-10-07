import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import {
  fetchAllDeals,
  testConnection,
  fetchPerson,
  fetchOrganization,
  fetchUser,
  mapPipedrivePersonToCustomer,
  mapPipedriveOrgToCustomer,
  mapPipedriveDealToJob,
  buildBillAddr,
  DEAL_FIELDS,
} from "@/lib/pipedrive";

type SyncProgress = {
  stage: "fetching" | "processing" | "complete" | "error" | "cancelled";
  message: string;
  processed?: number;
  total?: number;
  created?: number;
  updated?: number;
  errors?: number;
  jobId?: string;
};

function getNumericId(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const v = (value as { value?: unknown; id?: unknown }).value;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const parsed = Number(v);
      if (Number.isFinite(parsed)) return parsed;
    }
    const id = (value as { value?: unknown; id?: unknown }).id;
    if (typeof id === "number") return id;
    if (typeof id === "string") {
      const parsed = Number(id);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

async function upsertOrgCustomerSafe(
  orgCustomerData: ReturnType<typeof mapPipedriveOrgToCustomer>,
) {
  const serializedPipedriveData = JSON.parse(
    JSON.stringify(orgCustomerData.pipedriveData),
  );

  const existingByPipedrive = await prisma.customer.findUnique({
    where: { pipedriveId: orgCustomerData.pipedriveId },
    select: { id: true },
  });

  const conflictingByQuickbooks = orgCustomerData.quickbooksId
    ? await prisma.customer.findUnique({
        where: { quickbooksId: orgCustomerData.quickbooksId },
        select: { id: true },
      })
    : null;

  const canAssignQuickbooksId = Boolean(
    orgCustomerData.quickbooksId &&
    (!conflictingByQuickbooks ||
      conflictingByQuickbooks.id === existingByPipedrive?.id),
  );

  const dataForUpdate = {
    displayName: orgCustomerData.displayName,
    companyName: orgCustomerData.companyName,
    salesPerson: orgCustomerData.salesPerson,
    billAddr: orgCustomerData.billAddr,
    shipAddr: orgCustomerData.shipAddr,
    pipedriveData: serializedPipedriveData,
    active: true,
    type: orgCustomerData.type,
    updatedAt: new Date(),
  };

  const preferredQuickbooksId = canAssignQuickbooksId
    ? orgCustomerData.quickbooksId
    : undefined;

  const runUpsert = async (quickbooksId: string | undefined) => {
    await prisma.customer.upsert({
      where: { pipedriveId: orgCustomerData.pipedriveId },
      update: {
        ...dataForUpdate,
        quickbooksId,
      },
      create: {
        ...orgCustomerData,
        quickbooksId,
        pipedriveData: serializedPipedriveData,
      },
    });
  };

  try {
    await runUpsert(preferredQuickbooksId);
    return;
  } catch (error: any) {
    if (error?.code !== "P2002") {
      throw error;
    }
  }

  // Retry without quickbooksId when unique collisions happen (quickbooksId or concurrent create).
  const latestByPipedrive = await prisma.customer.findUnique({
    where: { pipedriveId: orgCustomerData.pipedriveId },
    select: { id: true },
  });

  if (latestByPipedrive) {
    await prisma.customer.update({
      where: { id: latestByPipedrive.id },
      data: {
        ...dataForUpdate,
        quickbooksId: undefined,
      },
    });
    return;
  }

  await runUpsert(undefined);
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getProgramUserContext("customersV2");
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const connectionOk = await testConnection();
    if (!connectionOk) {
      return NextResponse.json(
        {
          error: "Failed to connect to Pipedrive. Check your API credentials.",
        },
        { status: 500 },
      );
    }

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendProgress = async (data: SyncProgress) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    (async () => {
      let syncJob: { id: string } | undefined;

      try {
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

        const deals = await fetchAllDeals("all_not_deleted");

        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: { totalRecords: deals.length },
        });

        const dealsByPerson = new Map<string, typeof deals>();
        for (const deal of deals) {
          const personId = getNumericId(deal.person_id);
          const personKey = personId ? personId.toString() : `deal_${deal.id}`;
          const existing = dealsByPerson.get(personKey) ?? [];
          existing.push(deal);
          dealsByPerson.set(personKey, existing);
        }

        await sendProgress({
          stage: "processing",
          message: `Processing ${deals.length} deals...`,
          total: deals.length,
          jobId: syncJob.id,
        });

        let created = 0;
        let updated = 0;
        let errors = 0;
        let processedDeals = 0;

        const existingCustomers = await prisma.customer.findMany({
          where: {
            pipedriveId: {
              in: Array.from(dealsByPerson.keys()),
            },
          },
          select: { pipedriveId: true },
        });

        const existingPipedriveIds = new Set(
          existingCustomers
            .map((c) => c.pipedriveId)
            .filter(Boolean) as string[],
        );

        const personEntries = Array.from(dealsByPerson.entries());
        const batchSize = 40;

        const personFetchCache = new Map<
          number,
          Promise<Awaited<ReturnType<typeof fetchPerson>>>
        >();
        const orgFetchCache = new Map<
          number,
          Promise<Awaited<ReturnType<typeof fetchOrganization>>>
        >();
        const userFetchCache = new Map<
          number,
          Promise<Awaited<ReturnType<typeof fetchUser>>>
        >();

        const getCached = <T>(
          cache: Map<number, Promise<T>>,
          id: number,
          loader: (id: number) => Promise<T>,
        ) => {
          const cached = cache.get(id);
          if (cached) {
            return cached;
          }
          const pending = loader(id);
          cache.set(id, pending);
          return pending;
        };

        const processPersonEntry = async (
          personKey: string,
          personDeals: typeof deals,
        ) => {
          let createdInc = 0;
          let updatedInc = 0;
          let errorsInc = 0;
          let processedDealsInc = 0;

          try {
            const primaryDeal = personDeals[0];
            const personId = getNumericId(primaryDeal.person_id);
            const orgId = getNumericId(primaryDeal.org_id);
            const ownerId =
              getNumericId((primaryDeal as any).owner_id) ??
              getNumericId((primaryDeal as any).creator_user_id);

            const [personData, orgData, ownerData] = await Promise.all([
              personId
                ? getCached(personFetchCache, personId, fetchPerson)
                : Promise.resolve(null),
              orgId
                ? getCached(orgFetchCache, orgId, fetchOrganization)
                : Promise.resolve(null),
              ownerId
                ? getCached(userFetchCache, ownerId, fetchUser)
                : Promise.resolve(null),
            ]);

            if (orgData) {
              const orgCustomerData = mapPipedriveOrgToCustomer(
                orgData,
                ownerData?.name,
              );
              await upsertOrgCustomerSafe(orgCustomerData);
            }

            const addressData = buildBillAddr(
              primaryDeal.custom_fields?.[DEAL_FIELDS.ADDRESS],
            );

            const customerData = personData
              ? mapPipedrivePersonToCustomer(
                  personData,
                  orgData,
                  ownerData?.name,
                )
              : {
                  pipedriveId: personKey,
                  type: "CLIENT" as const,
                  displayName: primaryDeal.title || `Person #${personKey}`,
                  companyName: orgData?.name,
                  salesPerson: ownerData?.name,
                  referredByOrgPipedriveId: orgData
                    ? String(orgData.id)
                    : undefined,
                  referredByOrgName: orgData?.name,
                  pipedriveData: primaryDeal as any,
                  active:
                    primaryDeal.status === "open" ||
                    primaryDeal.status === "won",
                };

            (customerData as any).pipedriveId = personKey;

            const customerCreatedAt = primaryDeal.add_time
              ? new Date(primaryDeal.add_time)
              : new Date();
            const customerUpdatedAt = primaryDeal.update_time
              ? new Date(primaryDeal.update_time)
              : new Date();

            const customer = await prisma.customer.upsert({
              where: { pipedriveId: personKey },
              update: {
                ...customerData,
                billAddr: addressData || undefined,
                shipAddr: addressData || undefined,
                pipedriveData: JSON.parse(
                  JSON.stringify((customerData as any).pipedriveData),
                ),
                updatedAt: customerUpdatedAt,
              },
              create: {
                ...customerData,
                billAddr: addressData || undefined,
                shipAddr: addressData || undefined,
                pipedriveData: JSON.parse(
                  JSON.stringify((customerData as any).pipedriveData),
                ),
                createdAt: customerCreatedAt,
                updatedAt: customerUpdatedAt,
              },
            });

            if (existingPipedriveIds.has(personKey)) {
              updatedInc++;
            } else {
              createdInc++;
              existingPipedriveIds.add(personKey);
            }

            const jobResults = await Promise.allSettled(
              personDeals.map(async (deal) => {
                const jobData = mapPipedriveDealToJob(deal, customer.id);
                const dealCreatedAt = deal.add_time
                  ? new Date(deal.add_time)
                  : new Date();
                const dealUpdatedAt = deal.update_time
                  ? new Date(deal.update_time)
                  : new Date();

                await prisma.job.upsert({
                  where: { pipedriveId: jobData.pipedriveId },
                  update: {
                    customerId: customer.id,
                    jobName: jobData.jobName,
                    dealTitle: jobData.dealTitle,
                    value: jobData.value,
                    status: jobData.status as any,
                    stageId: jobData.stageId,
                    closeDate: jobData.closeDate,
                    expectedCloseDate: jobData.expectedCloseDate,
                    jobType: jobData.jobType,
                    quickbooksUrl: jobData.quickbooksUrl,
                    companyCamId: jobData.companyCamId,
                    companyCamUrl: jobData.companyCamUrl,
                    propertyAddress: jobData.propertyAddress,
                    updatedAt: dealUpdatedAt,
                    lastSyncedAt: new Date(),
                  },
                  create: {
                    customerId: customer.id,
                    pipedriveId: jobData.pipedriveId,
                    jobName: jobData.jobName,
                    dealTitle: jobData.dealTitle,
                    value: jobData.value,
                    status: jobData.status as any,
                    stageId: jobData.stageId,
                    closeDate: jobData.closeDate,
                    expectedCloseDate: jobData.expectedCloseDate,
                    jobType: jobData.jobType,
                    quickbooksUrl: jobData.quickbooksUrl,
                    companyCamId: jobData.companyCamId,
                    companyCamUrl: jobData.companyCamUrl,
                    propertyAddress: jobData.propertyAddress,
                    createdAt: dealCreatedAt,
                    updatedAt: dealUpdatedAt,
                    lastSyncedAt: new Date(),
                  },
                });
              }),
            );

            for (const result of jobResults) {
              if (result.status === "fulfilled") {
                processedDealsInc++;
              } else {
                console.error(
                  `[Pipedrive Sync] Failed to upsert one job for person ${personKey}:`,
                  result.reason,
                );
                errorsInc++;
              }
            }
          } catch (personError) {
            console.error(
              `[Pipedrive Sync] Failed to process ${personKey}:`,
              personError,
            );
            errorsInc++;
          }

          return {
            createdInc,
            updatedInc,
            errorsInc,
            processedDealsInc,
          };
        };

        const checkCancellation = async () => {
          if (!syncJob) return false;
          const job = await prisma.syncJob.findUnique({
            where: { id: syncJob.id },
            select: { cancelRequested: true },
          });
          return Boolean(job?.cancelRequested);
        };

        for (let start = 0; start < personEntries.length; start += batchSize) {
          if (await checkCancellation()) {
            await prisma.syncJob.update({
              where: { id: syncJob.id },
              data: {
                status: "cancelled",
                cancelledAt: new Date(),
                processedRecords: processedDeals,
                createdRecords: created,
                updatedRecords: updated,
                errorCount: errors,
              },
            });

            await sendProgress({
              stage: "cancelled",
              message: "Sync cancelled by user",
              processed: processedDeals,
              total: deals.length,
              created,
              updated,
              errors,
            });

            await writer.close();
            return;
          }

          const batch = personEntries.slice(start, start + batchSize);
          const batchResults = await Promise.all(
            batch.map(([personKey, personDeals]) =>
              processPersonEntry(personKey, personDeals),
            ),
          );

          for (const result of batchResults) {
            created += result.createdInc;
            updated += result.updatedInc;
            errors += result.errorsInc;
            processedDeals += result.processedDealsInc;
          }

          await prisma.syncJob.update({
            where: { id: syncJob.id },
            data: {
              processedRecords: processedDeals,
              createdRecords: created,
              updatedRecords: updated,
              errorCount: errors,
            },
          });

          await sendProgress({
            stage: "processing",
            message: `Processed ${processedDeals}/${deals.length} deals...`,
            processed: processedDeals,
            total: deals.length,
            created,
            updated,
            errors,
            jobId: syncJob.id,
          });
        }

        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            processedRecords: processedDeals,
            createdRecords: created,
            updatedRecords: updated,
            errorCount: errors,
          },
        });

        await sendProgress({
          stage: "complete",
          message: "Sync completed successfully",
          processed: processedDeals,
          total: deals.length,
          created,
          updated,
          errors,
          jobId: syncJob.id,
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
        });
      } finally {
        await writer.close();
      }
    })();

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
      const { appRole } = await getProgramUserContext("customersV2");
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
