import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CustomersV2Client from "./CustomersV2Client";

const ITEMS_PER_PAGE = 100;

export default async function CustomersV2Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    initial?: string;
    type?: string;
    status?: string;
    salesPerson?: string;
    source?: string;
    referredBy?: string;
    jobType?: string;
  }>;
}) {
  const { appRole } = await getCurrentUserWithRole();

  if (appRole !== "admin" && appRole !== "sales") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const currentPage = parseInt(params.page || "1");
  const searchTerm = params.search || "";
  const selectedInitial = params.initial || "";
  const selectedType = params.type || "";
  const selectedStatus = params.status || "";
  const selectedSalesPerson = params.salesPerson || "";
  const selectedSource = params.source || "";
  const selectedReferredBy = params.referredBy || "";
  const selectedJobType = params.jobType || "";

  // Build where clause
  const where: any = {};

  if (selectedType) {
    where.type = selectedType;
  }

  if (selectedStatus) {
    where.active = selectedStatus === "active";
  }

  if (selectedSalesPerson) {
    where.salesPerson = { contains: selectedSalesPerson, mode: "insensitive" };
  }

  if (selectedSource === "pipedrive") {
    where.pipedriveId = { not: null };
  } else if (selectedSource === "quickbooks") {
    where.quickbooksId = { not: null };
  }

  if (selectedReferredBy) {
    where.referredByOrgPipedriveId = selectedReferredBy;
  }

  if (searchTerm) {
    where.OR = [
      { pipedriveId: { contains: searchTerm, mode: "insensitive" } },
      { displayName: { contains: searchTerm, mode: "insensitive" } },
      { companyName: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  if (selectedInitial) {
    where.AND = [
      {
        OR: [
          { displayName: { startsWith: selectedInitial, mode: "insensitive" } },
          {
            displayName: {
              contains: ` ${selectedInitial}`,
              mode: "insensitive",
            },
          },
        ],
      },
    ];
  }

  // If filtering by jobType, we need to join through jobs
  if (selectedJobType) {
    where.jobs = {
      some: { jobType: { equals: selectedJobType, mode: "insensitive" } },
    };
  }

  const totalCustomers = await prisma.customer.count({ where });

  let customers = await prisma.customer.findMany({
    where,
    orderBy: [{ type: "asc" }, { displayName: "asc" }],
    skip: (currentPage - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
    include: {
      jobs: {
        select: {
          id: true,
          jobNumber: true,
          jobName: true,
          status: true,
          value: true,
          jobType: true,
          propertyAddress: true,
          companyCamUrl: true,
          quickbooksUrl: true,
          closeDate: true,
          pipedriveId: true,
        },
        orderBy: { createdAt: "desc" },
      },
      closetJobs: {
        select: {
          id: true,
          quoteNumber: true,
          status: true,
        },
      },
    },
  });

  // Client-side initial filter for precision
  if (selectedInitial) {
    customers = customers.filter((customer) => {
      const name = customer.displayName.trim();
      if (name.includes(",")) {
        return (
          name.split(",")[0].trim().charAt(0).toUpperCase() ===
          selectedInitial.toUpperCase()
        );
      }
      const parts = name.split(/\s+/);
      const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      return last.charAt(0).toUpperCase() === selectedInitial.toUpperCase();
    });
  }

  // Serialize Decimal fields
  const serializedCustomers = customers.map((c) => ({
    ...c,
    balance: c.balance?.toNumber() ?? null,
    jobs: c.jobs.map((j) => ({
      ...j,
      value: j.value?.toNumber() ?? null,
    })),
  }));

  // Aggregations for filters
  const allForFilters = await prisma.customer.findMany({
    select: {
      displayName: true,
      salesPerson: true,
      referredByOrgPipedriveId: true,
      referredByOrgName: true,
    },
  });

  const salesPersons = Array.from(
    new Set(
      allForFilters.map((c) => c.salesPerson).filter(Boolean) as string[],
    ),
  ).sort();

  // Unique contractors/designers (for "Referred by" filter)
  const contractorMap = new Map<string, string>();
  allForFilters.forEach((c) => {
    if (c.referredByOrgPipedriveId && c.referredByOrgName) {
      contractorMap.set(c.referredByOrgPipedriveId, c.referredByOrgName);
    }
  });
  const contractors = Array.from(contractorMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const lastNameInitials = Array.from(
    new Set(
      allForFilters
        .map((c) => {
          const name = c.displayName.trim();
          if (name.includes(","))
            return name.split(",")[0].trim().charAt(0).toUpperCase();
          const parts = name.split(/\s+/);
          return (parts.length > 1 ? parts[parts.length - 1] : parts[0])
            .charAt(0)
            .toUpperCase();
        })
        .filter((i) => /[A-Z]/.test(i)),
    ),
  ).sort();

  // Unique job types across all jobs
  const jobTypesRaw = await prisma.job.findMany({
    where: { jobType: { not: null } },
    select: { jobType: true },
    distinct: ["jobType"],
  });
  const jobTypes = jobTypesRaw
    .map((j) => j.jobType!)
    .filter(Boolean)
    .sort();

  return (
    <CustomersV2Client
      customers={serializedCustomers}
      userRole={appRole}
      currentPage={currentPage}
      totalPages={Math.ceil(totalCustomers / ITEMS_PER_PAGE)}
      totalCustomers={totalCustomers}
      lastNameInitials={lastNameInitials}
      salesPersons={salesPersons}
      contractors={contractors}
      jobTypes={jobTypes}
      initialSearchTerm={searchTerm}
      initialSelectedInitial={selectedInitial}
      initialSelectedType={selectedType}
      initialSelectedStatus={selectedStatus}
      initialSelectedSalesPerson={selectedSalesPerson}
      initialSelectedSource={selectedSource}
      initialSelectedReferredBy={selectedReferredBy}
      initialSelectedJobType={selectedJobType}
    />
  );
}
