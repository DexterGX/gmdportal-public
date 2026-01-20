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
} from "lucide-react";
import type { Customer } from "@prisma/client";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type CustomerWithJobs = Omit<Customer, "balance"> & {
  balance: number | null;
  closetJobs: Array<{
    id: string;
    quoteNumber: string;
    status: string;
  }>;
  jobs: Array<{
    id: string;
    jobName: string;
    status: string;
    value: number | null;
  }>;
};

interface Props {
  customers: CustomerWithJobs[];
  userRole: string;
  currentPage: number;
  totalPages: number;
  totalCustomers: number;
  lastNameInitials: string[];
  salesPersons: string[];
  initialSearchTerm: string;
  initialSelectedInitial: string;
  initialSelectedType: string;
  initialSelectedStatus: string;
  initialSelectedSalesPerson: string;
  initialSelectedSource: string;
}

export default function CustomersClient({
  customers,
  userRole,
  currentPage,
  totalPages,
  totalCustomers,
  lastNameInitials,
  salesPersons,
  initialSearchTerm,
  initialSelectedInitial,
  initialSelectedType,
  initialSelectedStatus,
  initialSelectedSalesPerson,
  initialSelectedSource,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Update URL when filters change
  useEffect(() => {
    // Skip on initial load
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
      params.set("page", "1"); // Reset to page 1 on filter change

      router.push(`/customers?${params.toString()}`);
    }, 500); // Debounce search

    return () => clearTimeout(timer);
  }, [
    searchTerm,
    selectedInitial,
    selectedType,
    selectedStatus,
    selectedSalesPerson,
    selectedSource,
  ]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/customers?${params.toString()}`);
  };

  const clearFilters = () => {
    setSelectedInitial("");
    setSelectedType("");
    setSelectedStatus("");
    setSelectedSalesPerson("");
    setSelectedSource("");
  };

  const hasActiveFilters =
    selectedInitial !== "" ||
    selectedType !== "" ||
    selectedStatus !== "" ||
    selectedSalesPerson !== "" ||
    selectedSource !== "";

  // Convert single initial to array for FilterMultiSelect
  const selectedInitials = selectedInitial ? [selectedInitial] : [];

  const handleInitialChange = (selected: string[]) => {
    // Only allow single selection
    setSelectedInitial(
      selected.length > 0 ? selected[selected.length - 1] : "",
    );
  };

  const handleTypeChange = (selected: string[]) => {
    // Only allow single selection
    setSelectedType(selected.length > 0 ? selected[selected.length - 1] : "");
  };

  // Type options for filter
  const typeOptions = ["Clients", "Contractors", "Prospects"];
  const selectedTypes = selectedType
    ? [
        selectedType === "CLIENT"
          ? "Clients"
          : selectedType === "CONTRACTOR"
            ? "Contractors"
            : "Prospects",
      ]
    : [];

  // Calculate which page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the start
        for (let i = 2; i <= Math.min(maxVisible, totalPages - 1); i++) {
          pages.push(i);
        }
        pages.push("...");
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push("...");
        for (let i = totalPages - maxVisible + 1; i < totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const formatAddress = (addr: any) => {
    if (!addr) return null;
    const parts = [
      addr.Line1,
      addr.City,
      addr.CountrySubDivisionCode,
      addr.PostalCode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Customer Directory
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage customer information synced from QuickBooks
          </p>
        </div>
        {userRole === "admin" && (
          <div className="flex gap-2">
            <Link
              href="/customers/pipedrive-sync"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Sync from Pipedrive
            </Link>
            <Link
              href="/customers/sync"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Sync from QuickBooks
            </Link>
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, company, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterMultiSelect
            label="Last Name"
            options={lastNameInitials}
            selected={selectedInitials}
            onChange={handleInitialChange}
          />

          <FilterMultiSelect
            label="Type"
            options={typeOptions}
            selected={selectedTypes}
            onChange={(selected) => {
              const value =
                selected.length > 0 ? selected[selected.length - 1] : "";
              const typeValue =
                value === "Clients"
                  ? "CLIENT"
                  : value === "Contractors"
                    ? "CONTRACTOR"
                    : value === "Prospects"
                      ? "PROSPECT"
                      : "";
              setSelectedType(typeValue);
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
            onChange={(selected) => {
              const value =
                selected.length > 0 ? selected[selected.length - 1] : "";
              setSelectedStatus(
                value === "Active"
                  ? "active"
                  : value === "Inactive"
                    ? "inactive"
                    : "",
              );
            }}
          />

          <FilterMultiSelect
            label="Sales Person"
            options={salesPersons}
            selected={selectedSalesPerson ? [selectedSalesPerson] : []}
            onChange={(selected) => {
              setSelectedSalesPerson(
                selected.length > 0 ? selected[selected.length - 1] : "",
              );
            }}
          />

          <FilterMultiSelect
            label="Source"
            options={["Pipedrive", "QuickBooks"]}
            selected={
              selectedSource
                ? [selectedSource === "pipedrive" ? "Pipedrive" : "QuickBooks"]
                : []
            }
            onChange={(selected) => {
              const value =
                selected.length > 0 ? selected[selected.length - 1] : "";
              setSelectedSource(
                value === "Pipedrive"
                  ? "pipedrive"
                  : value === "QuickBooks"
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
              Clear filters
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact Info
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Jobs
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    {searchTerm || hasActiveFilters
                      ? "No customers found matching your search or filters."
                      : "No customers available. Sync from QuickBooks to get started."}
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const address = formatAddress(
                    customer.billAddr || customer.shipAddr,
                  );
                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="block hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {customer.displayName}
                            </span>
                            <div className="flex items-center gap-1">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  customer.type === "CONTRACTOR"
                                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                    : customer.type === "PROSPECT"
                                      ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                }`}
                              >
                                {customer.type === "CONTRACTOR"
                                  ? "C"
                                  : customer.type === "PROSPECT"
                                    ? "P"
                                    : ""}
                              </span>
                              {customer.pipedriveId && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                  PD
                                </span>
                              )}
                              {customer.quickbooksId && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                  QB
                                </span>
                              )}
                            </div>
                          </div>
                          {customer.companyName && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                              <Building2 className="w-3 h-3" />
                              {customer.companyName}
                            </div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1">
                          {customer.email && (
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Mail className="w-3 h-3" />
                              <a
                                href={`mailto:${customer.email}`}
                                className="hover:text-blue-600 dark:hover:text-blue-400"
                              >
                                {customer.email}
                              </a>
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Phone className="w-3 h-3" />
                              <a
                                href={`tel:${customer.phone}`}
                                className="hover:text-blue-600 dark:hover:text-blue-400"
                              >
                                {customer.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {address && (
                          <div className="flex items-start gap-1">
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{address}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {customer.jobs.length > 0 ||
                        customer.closetJobs.length > 0 ? (
                          <div className="flex flex-col gap-1 items-center">
                            {customer.jobs.length > 0 && (
                              <Link
                                href={`/customers/${customer.id}#jobs`}
                                className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                              >
                                {customer.jobs.length} QB{" "}
                                {customer.jobs.length === 1 ? "Job" : "Jobs"}
                              </Link>
                            )}
                            {customer.closetJobs.length > 0 && (
                              <Link
                                href={`/customers/${customer.id}#closet-jobs`}
                                className="text-purple-600 dark:text-purple-400 hover:underline text-xs"
                              >
                                {customer.closetJobs.length} Closet{" "}
                                {customer.closetJobs.length === 1
                                  ? "Job"
                                  : "Jobs"}
                              </Link>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {(currentPage - 1) * 100 + 1}-
              {Math.min(currentPage * 100, totalCustomers)} of {totalCustomers}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {getPageNumbers().map((pageNum, idx) =>
                pageNum === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-3 py-1 text-gray-600 dark:text-gray-400"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum as number)}
                    className={`min-w-[32px] px-2 py-1 text-sm rounded ${
                      currentPage === pageNum
                        ? "bg-blue-600 text-white font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                ),
              )}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
