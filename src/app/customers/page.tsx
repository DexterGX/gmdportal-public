import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import CustomersClient from "./CustomersClient";
import { redirect } from "next/navigation";

const ITEMS_PER_PAGE = 100;

export default async function CustomersPage({
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
  }>;
}) {
  const { appRole } = await getCurrentUserWithRole();

  // Restrict access to admins and sales team
  if (appRole !== "admin" && appRole !== "sales") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const currentPage = parseInt(params.page || "1");
  const searchTerm = params.search || "";
  const selectedInitial = params.initial || "";
  const selectedType = params.type || ""; // CLIENT, CONTRACTOR, PROSPECT
  const selectedStatus = params.status || ""; // active, inactive
  const selectedSalesPerson = params.salesPerson || "";
  const selectedSource = params.source || ""; // pipedrive, quickbooks

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

  if (searchTerm) {
    where.OR = [
      { displayName: { contains: searchTerm, mode: "insensitive" } },
      { companyName: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  // Filter by last name initial if selected
  if (selectedInitial) {
    // For names with comma (Last, First), check if it starts with the initial
    // For names without comma, we'll need to do this in post-processing
    where.AND = [
      {
        OR: [
          // Matches "LastName, FirstName" format where LastName starts with initial
          { displayName: { startsWith: selectedInitial, mode: "insensitive" } },
          // Matches "FirstName LastName" where we need to check last word (handled below)
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

  // Get total count for pagination
  const totalCustomers = await prisma.customer.count({ where });

  // Fetch customers with pagination
  let customers = await prisma.customer.findMany({
    where,
    orderBy: { displayName: "asc" },
    skip: (currentPage - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
    include: {
      closetJobs: {
        select: {
          id: true,
          quoteNumber: true,
          status: true,
        },
      },
      jobs: {
        select: {
          id: true,
          jobName: true,
          status: true,
          value: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  // Additional client-side filtering for last name initial (more precise)
  if (selectedInitial) {
    customers = customers.filter((customer) => {
      const name = customer.displayName.trim();
      if (name.includes(",")) {
        const lastName = name.split(",")[0].trim();
        return (
          lastName.charAt(0).toUpperCase() === selectedInitial.toUpperCase()
        );
      } else {
        const parts = name.split(/\s+/);
        const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        return (
          lastName.charAt(0).toUpperCase() === selectedInitial.toUpperCase()
        );
      }
    });
  }

  // Serialize Decimal fields
  const serializedCustomers = customers.map((customer) => ({
    ...customer,
    balance: customer.balance?.toNumber() || null,
    jobs: customer.jobs.map((job) => ({
      ...job,
      value: job.value?.toNumber() || null,
    })),
  }));

  // Compute last name initials from all customers for filter
  const allCustomersForInitials = await prisma.customer.findMany({
    select: { displayName: true, salesPerson: true },
  });

  // Get unique sales persons
  const salesPersons = Array.from(
    new Set(
      allCustomersForInitials
        .map((c) => c.salesPerson)
        .filter((sp): sp is string => !!sp),
    ),
  ).sort();

  const lastNameInitials = Array.from(
    new Set(
      allCustomersForInitials
        .map((c) => {
          const name = c.displayName.trim();
          // Check if name contains comma (Last, First format)
          if (name.includes(",")) {
            const lastName = name.split(",")[0].trim();
            return lastName.charAt(0).toUpperCase();
          } else {
            // Fallback: assume last word is last name
            const parts = name.split(/\s+/);
            const lastName =
              parts.length > 1 ? parts[parts.length - 1] : parts[0];
            return lastName.charAt(0).toUpperCase();
          }
        })
        .filter((initial) => /[A-Z]/.test(initial)),
    ),
  ).sort();

  return (
    <CustomersClient
      customers={serializedCustomers}
      userRole={appRole}
      currentPage={currentPage}
      totalPages={Math.ceil(totalCustomers / ITEMS_PER_PAGE)}
      totalCustomers={totalCustomers}
      lastNameInitials={lastNameInitials}
      salesPersons={salesPersons}
      initialSearchTerm={searchTerm}
      initialSelectedInitial={selectedInitial}
      initialSelectedType={selectedType}
      initialSelectedStatus={selectedStatus}
      initialSelectedSalesPerson={selectedSalesPerson}
      initialSelectedSource={selectedSource}
    />
  );
}
