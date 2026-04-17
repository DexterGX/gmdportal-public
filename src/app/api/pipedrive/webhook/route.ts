import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PipedriveDeal,
  fetchPerson,
  fetchOrganization,
  fetchUser,
  mapPipedrivePersonToCustomer,
  mapPipedriveOrgToCustomer,
  mapPipedriveDealToJob,
  buildBillAddr,
  DEAL_FIELDS,
} from "@/lib/pipedrive";

function verifyPipedriveWebhook(
  request: NextRequest,
  secret?: string,
): boolean {
  if (!secret) return true;
  const signature = request.headers.get("x-pipedrive-signature");
  return signature === secret;
}

function getNumericId(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const v = (value as { value?: unknown; id?: unknown }).value;
    if (typeof v === "number") return v;
    const id = (value as { value?: unknown; id?: unknown }).id;
    if (typeof id === "number") return id;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.PIPEDRIVE_WEBHOOK_SECRET;

    if (webhookSecret && !verifyPipedriveWebhook(request, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload: any = await request.json();
    const meta = payload?.meta;
    const data = payload?.current ?? payload?.data;

    if (!meta || meta.entity !== "deal") {
      return NextResponse.json({ success: true, message: "Not a deal event" });
    }

    if (meta.action === "deleted" || meta.action === "delete") {
      const dealId = String(meta.entity_id);
      await prisma.job.updateMany({
        where: { pipedriveId: dealId },
        data: {
          status: "CANCELLED",
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({
        success: true,
        message: `Cancelled job ${dealId}`,
      });
    }

    if (!data || typeof data !== "object") {
      return NextResponse.json({ success: true, message: "No payload data" });
    }

    const personId = getNumericId(data.person_id);
    const orgId = getNumericId(data.org_id);
    const ownerId =
      getNumericId(data.owner_id) ?? getNumericId(data.creator_user_id);

    const [personData, orgData, ownerData] = await Promise.all([
      personId ? fetchPerson(personId) : Promise.resolve(null),
      orgId ? fetchOrganization(orgId) : Promise.resolve(null),
      ownerId ? fetchUser(ownerId) : Promise.resolve(null),
    ]);

    if (orgData) {
      const orgCustomerData = mapPipedriveOrgToCustomer(
        orgData,
        ownerData?.name,
      );
      await prisma.customer.upsert({
        where: { pipedriveId: orgCustomerData.pipedriveId },
        update: {
          displayName: orgCustomerData.displayName,
          companyName: orgCustomerData.companyName,
          salesPerson: orgCustomerData.salesPerson,
          billAddr: orgCustomerData.billAddr,
          shipAddr: orgCustomerData.shipAddr,
          quickbooksId: orgCustomerData.quickbooksId,
          pipedriveData: JSON.parse(
            JSON.stringify(orgCustomerData.pipedriveData),
          ),
          active: true,
          updatedAt: new Date(),
        },
        create: {
          ...orgCustomerData,
          pipedriveData: JSON.parse(
            JSON.stringify(orgCustomerData.pipedriveData),
          ),
        },
      });
    }

    const customerPipedriveId = personId
      ? String(personId)
      : `deal_${String(data.id)}`;
    const addressData = buildBillAddr(
      data.custom_fields?.[DEAL_FIELDS.ADDRESS],
    );

    const customerData = personData
      ? mapPipedrivePersonToCustomer(personData, orgData, ownerData?.name)
      : {
          pipedriveId: customerPipedriveId,
          type: "CLIENT" as const,
          displayName: data.title || `Deal #${String(data.id)}`,
          companyName: orgData?.name,
          salesPerson: ownerData?.name,
          referredByOrgPipedriveId: orgData ? String(orgData.id) : undefined,
          referredByOrgName: orgData?.name,
          pipedriveData: data,
          active: data.status === "open" || data.status === "won",
        };

    (customerData as any).pipedriveId = customerPipedriveId;

    const customerCreatedAt = data.add_time
      ? new Date(data.add_time)
      : new Date();
    const customerUpdatedAt = data.update_time
      ? new Date(data.update_time)
      : new Date();

    const customer = await prisma.customer.upsert({
      where: { pipedriveId: customerPipedriveId },
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

    const dealData: PipedriveDeal = {
      id: Number(data.id),
      title: String(data.title || `Deal #${String(data.id)}`),
      value: Number(data.value || 0),
      currency: String(data.currency || "USD"),
      status: String(data.status || "open"),
      stage_id: Number(data.stage_id || 0),
      pipeline_id: data.pipeline_id ? Number(data.pipeline_id) : undefined,
      person_id: personId,
      org_id: orgId,
      creator_user_id: ownerId,
      owner_id: ownerId,
      add_time: String(data.add_time || new Date().toISOString()),
      update_time: String(data.update_time || new Date().toISOString()),
      close_time: data.close_time || null,
      won_time: data.won_time || null,
      lost_time: data.lost_time || null,
      expected_close_date: data.expected_close_date || null,
      custom_fields: data.custom_fields || {},
    };

    const jobData = mapPipedriveDealToJob(dealData, customer.id);
    const dealCreatedAt = data.add_time ? new Date(data.add_time) : new Date();
    const dealUpdatedAt = data.update_time
      ? new Date(data.update_time)
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Pipedrive webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
