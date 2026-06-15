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
  const parseMultiParam = (value?: string) =>
    (value || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  const selectedInitials = parseMultiParam(params.initial);
  const selectedTypesRaw = parseMultiParam(params.type);
  const selectedStatuses = parseMultiParam(params.status);
  const selectedSalesPersons = parseMultiParam(params.salesPerson);
  const selectedSources = parseMultiParam(params.source);
  const selectedSourcesWithDefault =
    selectedSources.length > 0 ? selectedSources : ["pipedrive"];
  const selectedReferredBy = parseMultiParam(params.referredBy);
  const selectedJobTypes = parseMultiParam(params.jobType);

  const normalizeType = (value: string) =>
    value === "CLIENT"
      ? "CLIENTS"
      : value === "CONTRACTOR"
        ? "CONTRACTORS"
        : value;
  const normalizedSelectedTypes = selectedTypesRaw.map(normalizeType);

  // Build where clause
  const andConditions: any[] = [];

  if (normalizedSelectedTypes.length > 0) {
    const typeConditions = normalizedSelectedTypes.map((selectedType) => {
      if (selectedType === "CLIENTS") {
        return {
          type: "CLIENT",
          referredByOrgPipedriveId: null,
        };
      }
      if (selectedType === "CONTRACTOR_CLIENTS") {
        return {
          type: "CLIENT",
          referredByOrgPipedriveId: { not: null },
        };
      }
      if (selectedType === "CONTRACTORS") {
        return { type: "CONTRACTOR" };
      }
      return { type: selectedType };
    });

    andConditions.push({ OR: typeConditions });
  }

  if (selectedStatuses.length === 1) {
    andConditions.push({ active: selectedStatuses[0] === "active" });
  }

  if (selectedSalesPersons.length > 0) {
    andConditions.push({
      OR: selectedSalesPersons.map((salesPerson) => ({
        salesPerson: { contains: salesPerson, mode: "insensitive" },
      })),
    });
  }

  if (selectedSourcesWithDefault.length === 1) {
    if (selectedSourcesWithDefault[0] === "pipedrive") {
      andConditions.push({ pipedriveId: { not: null } });
    } else if (selectedSourcesWithDefault[0] === "quickbooks") {
      andConditions.push({ quickbooksId: { not: null } });
    }
  }

  if (selectedReferredBy.length > 0) {
    andConditions.push({
      OR: selectedReferredBy.flatMap((referredBy) => [
        { referredByOrgPipedriveId: referredBy },
        { pipedriveId: `org_${referredBy}` },
        { pipedriveId: referredBy },
      ]),
    });
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        { pipedriveId: { contains: searchTerm, mode: "insensitive" } },
        { displayName: { contains: searchTerm, mode: "insensitive" } },
        { companyName: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { phone: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (selectedInitials.length > 0) {
    andConditions.push({
      OR: selectedInitials.flatMap((selectedInitial) => [
        { displayName: { startsWith: selectedInitial, mode: "insensitive" } },
        {
          displayName: {
            contains: ` ${selectedInitial}`,
            mode: "insensitive",
          },
        },
      ]),
    });
  }

  // If filtering by jobType, we need to join through jobs.
  if (selectedJobTypes.length > 0) {
    andConditions.push({
      jobs: {
        some: {
          OR: selectedJobTypes.map((selectedJobType) => ({
            jobType: { equals: selectedJobType, mode: "insensitive" },
          })),
        },
      },
    });
  }

  const where: any = andConditions.length > 0 ? { AND: andConditions } : {};

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
  if (selectedInitials.length > 0) {
    customers = customers.filter((customer) => {
      const name = customer.displayName.trim();
      if (name.includes(",")) {
        const initial = name.split(",")[0].trim().charAt(0).toUpperCase();
        return selectedInitials.map((i) => i.toUpperCase()).includes(initial);
      }
      const parts = name.split(/\s+/);
      const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      return selectedInitials
        .map((i) => i.toUpperCase())
        .includes(last.charAt(0).toUpperCase());
    });
  }

  // Serialize Decimal fields
  const referredClientCounts = await prisma.customer.groupBy({
    by: ["referredByOrgPipedriveId"],
    where: {
      type: "CLIENT",
      referredByOrgPipedriveId: { not: null },
    },
    _count: { _all: true },
  });

  const referredClientCountByOrg = new Map<string, number>();
  referredClientCounts.forEach((row) => {
    if (!row.referredByOrgPipedriveId) {
      return;
    }
    referredClientCountByOrg.set(row.referredByOrgPipedriveId, row._count._all);
  });

  const normalizeOrgPipedriveId = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }
    return value.replace(/^org_/, "");
  };

  const serializedCustomers = customers.map((c) => ({
    ...c,
    referredClientCount:
      c.type === "CONTRACTOR"
        ? (referredClientCountByOrg.get(
            normalizeOrgPipedriveId(c.pipedriveId) || "",
          ) ?? 0)
        : null,
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
      initialSelectedInitial={selectedInitials}
      initialSelectedType={normalizedSelectedTypes}
      initialSelectedStatus={selectedStatuses}
      initialSelectedSalesPerson={selectedSalesPersons}
      initialSelectedSource={selectedSourcesWithDefault}
      initialSelectedReferredBy={selectedReferredBy}
      initialSelectedJobType={selectedJobTypes}
    />
  );
}
