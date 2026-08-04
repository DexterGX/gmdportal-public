/**
 * Customer lookup for Fabrication Orders — mirrors the Payment Term / misc-estimates
 * lookup pattern: search the Customer Program as the user types, return each
 * customer's linked Jobs/Deals so the form can offer a Job/Deal dropdown.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

type JobRecord = {
  id: string;
  jobName: string;
  dealTitle: string | null;
  pipedriveId: string | null;
  propertyAddress: string | null;
  status: string;
};

function formatBillAddr(billAddr: unknown): string | null {
  if (!billAddr || typeof billAddr !== "object") return null;
  const addr = billAddr as Record<string, unknown>;
  const parts = [
    addr["Line1"],
    addr["City"],
    addr["CountrySubDivisionCode"],
    addr["PostalCode"],
  ]
    .filter(Boolean)
    .join(", ");
  return parts || null;
}

function normalizeOrgId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^org_/, "");
}

function inferContractor(
  type: string,
  companyName: string | null,
  referredByOrgName: string | null,
): string | null {
  if (type === "CONTRACTOR") return companyName?.trim() || null;
  return referredByOrgName?.trim() || null;
}

export async function GET(request: NextRequest) {
  try {
    const { user, appRole, isActive } = await getCurrentUserWithRole();
    if (!user || !isActive || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { pipedriveId: { contains: q, mode: "insensitive" } },
          { referredByOrgName: { contains: q, mode: "insensitive" } },
          {
            jobs: {
              some: {
                OR: [
                  { jobName: { contains: q, mode: "insensitive" } },
                  { dealTitle: { contains: q, mode: "insensitive" } },
                  { pipedriveId: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
      select: {
        id: true,
        type: true,
        displayName: true,
        companyName: true,
        pipedriveId: true,
        referredByOrgName: true,
        referredByOrgPipedriveId: true,
        billAddr: true,
        jobs: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            jobName: true,
            dealTitle: true,
            pipedriveId: true,
            propertyAddress: true,
            status: true,
          },
        },
      },
      take: 8,
      orderBy: { displayName: "asc" },
    });

    const orgIds = Array.from(
      new Set(
        customers
          .map((c) => normalizeOrgId(c.referredByOrgPipedriveId))
          .filter(Boolean) as string[],
      ),
    );

    const linkedOrgCustomers =
      orgIds.length > 0
        ? await prisma.customer.findMany({
            where: {
              OR: [
                { pipedriveId: { in: orgIds } },
                { pipedriveId: { in: orgIds.map((id) => `org_${id}`) } },
              ],
            },
            select: {
              pipedriveId: true,
              jobs: {
                orderBy: { updatedAt: "desc" },
                select: {
                  id: true,
                  jobName: true,
                  dealTitle: true,
                  pipedriveId: true,
                  propertyAddress: true,
                  status: true,
                },
              },
            },
          })
        : [];

    const jobsByOrgId = new Map<string, JobRecord[]>();
    for (const orgCustomer of linkedOrgCustomers) {
      const normalizedOrgId = normalizeOrgId(orgCustomer.pipedriveId);
      if (!normalizedOrgId) continue;
      const existing = jobsByOrgId.get(normalizedOrgId) ?? [];
      existing.push(...(orgCustomer.jobs as JobRecord[]));
      jobsByOrgId.set(normalizedOrgId, existing);
    }

    return NextResponse.json({
      results: customers.map((customer) => {
        const orgId = normalizeOrgId(customer.referredByOrgPipedriveId);
        const orgJobs = orgId ? (jobsByOrgId.get(orgId) ?? []) : [];
        const customerName = customer.displayName.toLowerCase();

        const orgJobsForClient = orgJobs.filter((job) => {
          const title = (job.dealTitle || job.jobName || "").toLowerCase();
          return customerName && title.includes(customerName);
        });

        const mergedJobs = [...customer.jobs, ...orgJobsForClient];
        const uniqueJobs = Array.from(
          new Map(mergedJobs.map((job) => [job.id, job])).values(),
        );

        return {
          id: customer.id,
          displayName: customer.displayName,
          pipedriveId: customer.pipedriveId,
          contractor: inferContractor(
            customer.type,
            customer.companyName,
            customer.referredByOrgName,
          ),
          customerAddress: formatBillAddr(customer.billAddr),
          jobs: uniqueJobs.map((job) => ({
            id: job.id,
            dealId: job.pipedriveId,
            dealName: job.dealTitle || job.jobName,
            address: job.propertyAddress,
            status: job.status,
          })),
        };
      }),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to lookup clients" },
      { status: 500 },
    );
  }
}
