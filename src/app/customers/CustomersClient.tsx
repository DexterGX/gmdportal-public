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
};

interface Props {
  customers: CustomerWithJobs[];
  userRole: string;
  currentPage: number;
  totalPages: number;
  totalCustomers: number;
  lastNameInitials: string[];
  initialSearchTerm: string;
  initialInactiveOnly: boolean;
  initialSelectedInitial: string;
}

export default function CustomersClient({
  customers,
  userRole,
  currentPage,
  totalPages,
  totalCustomers,
  lastNameInitials,
  initialSearchTerm,
  initialInactiveOnly,
  initialSelectedInitial,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [showInactiveOnly, setShowInactiveOnly] = useState(initialInactiveOnly);
  const [selectedInitial, setSelectedInitial] = useState(
    initialSelectedInitial
  );
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
      if (showInactiveOnly) params.set("inactive", "true");
      if (selectedInitial) params.set("initial", selectedInitial);
      params.set("page", "1"); // Reset to page 1 on filter change

      router.push(`/customers?${params.toString()}`);
    }, 500); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, showInactiveOnly, selectedInitial]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/customers?${params.toString()}`);
  };

  const clearFilters = () => {
    setSelectedInitial("");
    setShowInactiveOnly(false);
  };

  const hasActiveFilters = selectedInitial !== "" || showInactiveOnly;

  // Convert single initial to array for FilterMultiSelect
  const selectedInitials = selectedInitial ? [selectedInitial] : [];

  const handleInitialChange = (selected: string[]) => {
    // Only allow single selection
    setSelectedInitial(
      selected.length > 0 ? selected[selected.length - 1] : ""
    );
  };

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
          <Link
            href="/customers/sync"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Sync from QuickBooks
          </Link>
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

          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <input
              type="checkbox"
              checked={showInactiveOnly}
              onChange={(e) => setShowInactiveOnly(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Inactive only</span>
          </label>

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
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Jobs
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Synced
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
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
                    customer.billAddr || customer.shipAddr
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
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {customer.displayName}
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
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                        {customer.balance !== null
                          ? new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                            }).format(customer.balance)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {customer.closetJobs.length > 0 ? (
                          <Link
                            href={`/customers/${customer.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {customer.closetJobs.length}
                          </Link>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {customer.lastSyncedAt
                          ? new Date(customer.lastSyncedAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            customer.active
                              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {customer.active ? "Active" : "Inactive"}
                        </span>
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
                )
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
