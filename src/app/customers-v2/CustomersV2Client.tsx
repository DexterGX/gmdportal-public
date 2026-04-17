"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Mail,
  Phone,
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Users,
  UserCheck,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type SerializedJob = {
  id: string;
  jobNumber: number;
  jobName: string;
  status: string;
  value: number | null;
  jobType: string | null;
  propertyAddress: string | null;
  companyCamUrl: string | null;
  quickbooksUrl: string | null;
  closeDate: Date | string | null;
  pipedriveId: string | null;
};

type SerializedCustomer = {
  id: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  type: string;
  active: boolean;
  balance: number | null;
  salesPerson: string | null;
  pipedriveId: string | null;
  quickbooksId: string | null;
  referredByOrgPipedriveId: string | null;
  referredByOrgName: string | null;
  billAddr: any;
  shipAddr: any;
  jobs: SerializedJob[];
  closetJobs: Array<{ id: string; quoteNumber: string; status: string }>;
};

interface Props {
  customers: SerializedCustomer[];
  userRole: string;
  currentPage: number;
  totalPages: number;
  totalCustomers: number;
  lastNameInitials: string[];
  salesPersons: string[];
  contractors: Array<{ id: string; name: string }>;
  jobTypes: string[];
  initialSearchTerm: string;
  initialSelectedInitial: string;
  initialSelectedType: string;
  initialSelectedStatus: string;
  initialSelectedSalesPerson: string;
  initialSelectedSource: string;
  initialSelectedReferredBy: string;
  initialSelectedJobType: string;
}

const typeColors: Record<string, string> = {
  CLIENT: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
  CONTRACTOR:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  PROSPECT:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
};

const typeLabels: Record<string, string> = {
  CLIENT: "Client",
  CONTRACTOR: "Contractor",
  PROSPECT: "Prospect",
};

const jobStatusColors: Record<string, string> = {
  ONGOING: "text-blue-600 dark:text-blue-400",
  COMPLETE: "text-green-600 dark:text-green-400",
  ON_HOLD: "text-yellow-600 dark:text-yellow-400",
  CANCELLED: "text-red-500 dark:text-red-400",
};

const formatJobStatusLabel = (status: string) => {
  if (status === "COMPLETE") return "SOLD";
  return status.replace("_", " ");
};

export default function CustomersV2Client({
  customers,
  userRole,
  currentPage,
  totalPages,
  totalCustomers,
  lastNameInitials,
  salesPersons,
  contractors,
  jobTypes,
  initialSearchTerm,
  initialSelectedInitial,
  initialSelectedType,
  initialSelectedStatus,
  initialSelectedSalesPerson,
  initialSelectedSource,
  initialSelectedReferredBy,
  initialSelectedJobType,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQueryString = searchParams.toString();

  const buildCustomerDetailHref = (customerId: string, hash?: string) => {
    const base = `/customers-v2/${customerId}`;
    const withQuery = currentQueryString
      ? `${base}?${currentQueryString}`
      : base;
    return hash ? `${withQuery}#${hash}` : withQuery;
  };

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedInitial, setSelectedInitial] = useState(
    initialSelectedInitial,
  );
  const [selectedType, setSelectedType] = useState(initialSelectedType);
  const [selectedStatus, setSelectedStatus] = useState(initialSelectedStatus);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState(
    initialSelectedSalesPerson,
  );
  const [selectedSource, setSelectedSource] = useState(initialSelectedSource);
  const [selectedReferredBy, setSelectedReferredBy] = useState(
    initialSelectedReferredBy,
  );
  const [selectedJobType, setSelectedJobType] = useState(
    initialSelectedJobType,
  );
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedInitial) params.set("initial", selectedInitial);
      if (selectedType) params.set("type", selectedType);
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedSalesPerson) params.set("salesPerson", selectedSalesPerson);
      if (selectedSource) params.set("source", selectedSource);
      if (selectedReferredBy) params.set("referredBy", selectedReferredBy);
      if (selectedJobType) params.set("jobType", selectedJobType);
      params.set("page", "1");
      router.push(`/customers-v2?${params.toString()}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [
    searchTerm,
    selectedInitial,
    selectedType,
    selectedStatus,
    selectedSalesPerson,
    selectedSource,
    selectedReferredBy,
    selectedJobType,
  ]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/customers-v2?${params.toString()}`);
  };

  const clearFilters = () => {
    setSelectedInitial("");
    setSelectedType("");
    setSelectedStatus("");
    setSelectedSalesPerson("");
    setSelectedSource("");
    setSelectedReferredBy("");
    setSelectedJobType("");
  };

  const hasActiveFilters =
    selectedInitial !== "" ||
    selectedType !== "" ||
    selectedStatus !== "" ||
    selectedSalesPerson !== "" ||
    selectedSource !== "" ||
    selectedReferredBy !== "" ||
    selectedJobType !== "";

  const formatAddress = (addr: any): string | null => {
    if (!addr) return null;
    const parts = [
      addr.Line1,
      addr.City,
      addr.CountrySubDivisionCode,
      addr.PostalCode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage <= 3) {
        for (let i = 2; i <= Math.min(maxVisible, totalPages - 1); i++)
          pages.push(i);
        pages.push("...");
      } else if (currentPage >= totalPages - 2) {
        pages.push("...");
        for (let i = totalPages - maxVisible + 1; i < totalPages; i++)
          pages.push(i);
      } else {
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
      }
      pages.push(totalPages);
    }
    return pages;
  };

  // Counts
  const clientCount = customers.filter((c) => c.type === "CLIENT").length;
  const contractorCount = customers.filter(
    (c) => c.type === "CONTRACTOR",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            Customers
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Unified client & contractor directory —{" "}
            {totalCustomers.toLocaleString()} total
          </p>
        </div>
        {userRole === "admin" && (
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/customers-v2/sync"
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Sync Pipedrive
            </Link>
          </div>
        )}
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            setSelectedType(selectedType === "CLIENT" ? "" : "CLIENT")
          }
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            selectedType === "CLIENT"
              ? "bg-teal-600 text-white border-teal-600"
              : "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-100"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          {clientCount} Clients
        </button>
        <button
          onClick={() =>
            setSelectedType(selectedType === "CONTRACTOR" ? "" : "CONTRACTOR")
          }
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            selectedType === "CONTRACTOR"
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          {contractorCount} Contractors / Designers
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search Pipedrive ID, name, company, email, phone…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterMultiSelect
            label="Last Name"
            options={lastNameInitials}
            selected={selectedInitial ? [selectedInitial] : []}
            onChange={(s) =>
              setSelectedInitial(s.length ? s[s.length - 1] : "")
            }
          />

          <FilterMultiSelect
            label="Type"
            options={["Client", "Contractor / Designer", "Prospect"]}
            selected={
              selectedType
                ? [
                    selectedType === "CLIENT"
                      ? "Client"
                      : selectedType === "CONTRACTOR"
                        ? "Contractor / Designer"
                        : "Prospect",
                  ]
                : []
            }
            onChange={(s) => {
              const v = s.length ? s[s.length - 1] : "";
              setSelectedType(
                v === "Client"
                  ? "CLIENT"
                  : v === "Contractor / Designer"
                    ? "CONTRACTOR"
                    : v === "Prospect"
                      ? "PROSPECT"
                      : "",
              );
            }}
          />

          <FilterMultiSelect
            label="Status"
            options={["Active", "Inactive"]}
            selected={
              selectedStatus
                ? [selectedStatus === "active" ? "Active" : "Inactive"]
                : []
            }
            onChange={(s) => {
              const v = s.length ? s[s.length - 1] : "";
              setSelectedStatus(
                v === "Active" ? "active" : v === "Inactive" ? "inactive" : "",
              );
            }}
          />

          {salesPersons.length > 0 && (
            <FilterMultiSelect
              label="Sales Person"
              options={salesPersons}
              selected={selectedSalesPerson ? [selectedSalesPerson] : []}
              onChange={(s) =>
                setSelectedSalesPerson(s.length ? s[s.length - 1] : "")
              }
            />
          )}

          {contractors.length > 0 && (
            <FilterMultiSelect
              label="Referred By"
              options={contractors.map((c) => c.name)}
              selected={
                selectedReferredBy
                  ? [
                      contractors.find((c) => c.id === selectedReferredBy)
                        ?.name ?? "",
                    ]
                  : []
              }
              onChange={(s) => {
                const name = s.length ? s[s.length - 1] : "";
                const found = contractors.find((c) => c.name === name);
                setSelectedReferredBy(found ? found.id : "");
              }}
            />
          )}

          {jobTypes.length > 0 && (
            <FilterMultiSelect
              label="Job Type"
              options={jobTypes}
              selected={selectedJobType ? [selectedJobType] : []}
              onChange={(s) =>
                setSelectedJobType(s.length ? s[s.length - 1] : "")
              }
            />
          )}

          <FilterMultiSelect
            label="Source"
            options={["Pipedrive", "QuickBooks"]}
            selected={
              selectedSource
                ? [selectedSource === "pipedrive" ? "Pipedrive" : "QuickBooks"]
                : []
            }
            onChange={(s) => {
              const v = s.length ? s[s.length - 1] : "";
              setSelectedSource(
                v === "Pipedrive"
                  ? "pipedrive"
                  : v === "QuickBooks"
                    ? "quickbooks"
                    : "",
              );
            }}
          />

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[120px]">
                  PD ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Jobs
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    {searchTerm || hasActiveFilters
                      ? "No customers match your search or filters."
                      : "No customers yet. Sync from Pipedrive to get started."}
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const address = formatAddress(
                    customer.billAddr || customer.shipAddr,
                  );
                  const isContractor = customer.type === "CONTRACTOR";

                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                    >
                      {/* Pipedrive ID */}
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex items-center text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {customer.pipedriveId ?? "-"}
                        </span>
                      </td>

                      {/* Customer name + badges */}
                      <td className="px-4 py-3">
                        <Link
                          href={buildCustomerDetailHref(customer.id)}
                          className="block group"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                              {customer.displayName}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                typeColors[customer.type] ??
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {typeLabels[customer.type] ?? customer.type}
                            </span>
                            {!customer.active && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                Inactive
                              </span>
                            )}
                            {customer.pipedriveId && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                                PD
                              </span>
                            )}
                            {customer.quickbooksId && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                QB
                              </span>
                            )}
                          </div>

                          {/* Contractor org name */}
                          {isContractor && customer.companyName && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                              <Building2 className="w-3 h-3" />
                              {customer.companyName}
                            </div>
                          )}

                          {/* Client — show referred by */}
                          {!isContractor && customer.referredByOrgName && (
                            <div className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-1">
                              <UserCheck className="w-3 h-3" />
                              via {customer.referredByOrgName}
                            </div>
                          )}

                          {/* Sales person */}
                          {customer.salesPerson && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {customer.salesPerson}
                            </div>
                          )}
                        </Link>
                      </td>

                      {/* Contact info */}
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1">
                          {customer.email && (
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <a
                                href={`mailto:${customer.email}`}
                                className="hover:text-teal-600 dark:hover:text-teal-400 truncate max-w-[180px]"
                              >
                                {customer.email}
                              </a>
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              <a
                                href={`tel:${customer.phone}`}
                                className="hover:text-teal-600 dark:hover:text-teal-400"
                              >
                                {customer.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Address */}
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                        {address && (
                          <div className="flex items-start gap-1">
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{address}</span>
                          </div>
                        )}
                      </td>

                      {/* Jobs */}
                      <td className="px-4 py-3 text-sm">
                        {customer.jobs.length > 0 ||
                        customer.closetJobs.length > 0 ? (
                          <div className="space-y-1">
                            {customer.jobs.slice(0, 3).map((job) => (
                              <div
                                key={job.id}
                                className="flex items-center gap-1.5"
                              >
                                <Link
                                  href={buildCustomerDetailHref(
                                    customer.id,
                                    `job-${job.id}`,
                                  )}
                                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-mono"
                                >
                                  #{job.jobNumber}
                                </Link>
                                <span
                                  className={`text-xs font-medium ${
                                    jobStatusColors[job.status] ??
                                    "text-gray-500"
                                  }`}
                                >
                                  {formatJobStatusLabel(job.status)}
                                </span>
                                {job.jobType && (
                                  <span className="text-xs text-gray-400">
                                    · {job.jobType}
                                  </span>
                                )}
                                {job.companyCamUrl && (
                                  <a
                                    href={job.companyCamUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                            {customer.jobs.length > 3 && (
                              <Link
                                href={buildCustomerDetailHref(
                                  customer.id,
                                  "jobs",
                                )}
                                className="text-xs text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
                              >
                                +{customer.jobs.length - 3} more
                              </Link>
                            )}
                            {customer.closetJobs.length > 0 && (
                              <Link
                                href={buildCustomerDetailHref(
                                  customer.id,
                                  "closet-jobs",
                                )}
                                className="text-xs text-purple-600 dark:text-purple-400 hover:underline block"
                              >
                                {customer.closetJobs.length} Closet{" "}
                                {customer.closetJobs.length === 1
                                  ? "Job"
                                  : "Jobs"}
                              </Link>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {currentPage} of {totalPages} ·{" "}
              {totalCustomers.toLocaleString()} customers
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {getPageNumbers().map((page, i) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-2 text-gray-400 text-sm"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page as number)}
                    className={`px-3 py-1 rounded text-sm ${
                      page === currentPage
                        ? "bg-teal-600 text-white"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats footer */}
      <p className="text-xs text-center text-gray-400 dark:text-gray-500">
        Showing {customers.length} of {totalCustomers.toLocaleString()}{" "}
        customers on this page
      </p>
    </div>
  );
}
