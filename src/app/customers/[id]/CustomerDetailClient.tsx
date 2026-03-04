"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  Briefcase,
} from "lucide-react";
import type { Customer, Job, ClosetJob } from "@prisma/client";

type CustomerWithDetails = Omit<Customer, "balance"> & {
  balance: number | null;
  jobs: Array<
    Omit<Job, "value"> & {
      value: number | null;
      jobNumber: number;
    }
  >;
  closetJobs: Array<
    ClosetJob & {
      quotes: Array<{
        id: string;
        quoteCode: string;
        status: string;
        finalPrice: number;
      }>;
    }
  >;
};

interface Props {
  customer: CustomerWithDetails;
  userRole: string;
}

const statusColors = {
  ONGOING: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  COMPLETE:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  ON_HOLD:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
};

const closetJobStatusColors = {
  QUOTE:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  REVIEW: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  APPROVED:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
};

export default function CustomerDetailClient({ customer, userRole }: Props) {
  const formatAddress = (addr: any) => {
    if (!addr) return null;
    const parts = [
      addr.Line1,
      addr.Line2,
      addr.City,
      addr.CountrySubDivisionCode,
      addr.PostalCode,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const address = formatAddress(customer.billAddr || customer.shipAddr);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/customers"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {customer.displayName}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Customer Details
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {customer.pipedriveId && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                Pipedrive
              </span>
            )}
            {customer.quickbooksId && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                QuickBooks
              </span>
            )}
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                customer.active
                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
              }`}
            >
              {customer.active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {/* Customer Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Contact Information
            </h2>
            <div className="space-y-3">
              {customer.companyName && (
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      Organization:
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {customer.companyName}
                    </span>
                  </div>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      Email:
                    </span>
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      Phone:
                    </span>
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              {address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      Address:
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {address}
                    </a>
                  </div>
                </div>
              )}
              {(customer as any).salesPerson && (
                <div className="flex items-start gap-3">
                  <Briefcase className="w-4 h-4 text-gray-400 mt-1" />
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      Sales Person:
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {(customer as any).salesPerson}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Account Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    customer.type === "CLIENT"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                      : customer.type === "CONTRACTOR"
                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                  }`}
                >
                  {customer.type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Balance:
                </span>
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {customer.balance !== null
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(customer.balance)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Last Synced:
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {customer.lastSyncedAt
                    ? new Date(customer.lastSyncedAt).toLocaleDateString()
                    : "Never"}
                </span>
              </div>
              {customer.quickbooksId && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    QuickBooks:
                  </span>
                  <span className="text-green-600 dark:text-green-400 text-sm">
                    ✓ Synced
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Jobs Section */}
        {customer.jobs.length > 0 && (
          <div
            id="jobs"
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Jobs ({customer.jobs.length})
            </h2>
            <div className="space-y-3">
              {customer.jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400">
                        {job.jobName}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Job #
                        <span className="font-mono font-semibold">
                          {job.jobNumber}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {job.value !== null && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                            }).format(job.value)}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Created:{" "}
                          {new Date(job.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <Calendar className="w-3 h-3" />
                          Updated:{" "}
                          {new Date(job.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      {job.quickbooksJobId && (
                        <div className="mt-2">
                          <a
                            href={`https://qbo.intuit.com/app/customerdetail?nameId=${job.quickbooksJobId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View in QuickBooks →
                          </a>
                        </div>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        statusColors[job.status as keyof typeof statusColors]
                      }`}
                    >
                      {job.status.replace("_", " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Closet Jobs Section */}
        {customer.closetJobs.length > 0 && (
          <div
            id="closet-jobs"
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Closet Jobs ({customer.closetJobs.length})
            </h2>
            <div className="space-y-3">
              {customer.closetJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/closet-jobs/${job.id}`}
                  className="block border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {job.quoteNumber}
                        </h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          • {job.area}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {job.propertyAddress}
                      </div>
                      {job.quotes.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {job.quotes.length} quote
                          {job.quotes.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        closetJobStatusColors[
                          job.status as keyof typeof closetJobStatusColors
                        ]
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* No Jobs Message */}
        {customer.jobs.length === 0 && customer.closetJobs.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
              No Jobs Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              This customer doesn&apos;t have any QuickBooks or Closet jobs
              associated.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
