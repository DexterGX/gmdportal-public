"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  Briefcase,
  ExternalLink,
  UserCheck,
  Users,
  Hash,
  Tag,
  Camera,
  BookOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SerializedJob {
  id: string;
  jobNumber: number;
  jobName: string;
  dealTitle: string | null;
  status: string;
  value: number | null;
  jobType: string | null;
  stageId: number | null;
  closeDate: string | Date | null;
  expectedCloseDate: string | Date | null;
  propertyAddress: string | null;
  companyCamId: string | null;
  companyCamUrl: string | null;
  quickbooksUrl: string | null;
  quickbooksJobId: string | null;
  pipedriveId: string | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface ClosetQuote {
  id: string;
  quoteCode: string;
  status: string;
  finalPrice: number;
}

interface SerializedClosetJob {
  id: string;
  quoteNumber: string;
  status: string;
  propertyAddress: string;
  area: string;
  quotes: ClosetQuote[];
  createdAt: string | Date;
}

interface SerializedCustomer {
  id: string;
  displayName: string;
  companyName: string | null;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  type: string;
  active: boolean;
  balance: number | null;
  salesPerson: string | null;
  pipedriveId: string | null;
  quickbooksId: string | null;
  companyCamId: string | null;
  referredByOrgPipedriveId: string | null;
  referredByOrgName: string | null;
  billAddr: any;
  shipAddr: any;
  notes: string | null;
  lastSyncedAt: string | Date | null;
  createdAt: string | Date;
  jobs: SerializedJob[];
  closetJobs: SerializedClosetJob[];
}

interface ReferredClient {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  type: string;
  jobs: Array<{
    id: string;
    jobNumber: number;
    jobName: string;
    status: string;
    value: number | null;
    jobType: string | null;
  }>;
}

interface Props {
  customer: SerializedCustomer;
  referredClients: ReferredClient[];
  userRole: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeColors: Record<string, string> = {
  CLIENT: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
  CONTRACTOR:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  PROSPECT:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
};

const jobStatusColors: Record<string, string> = {
  ONGOING: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  COMPLETE:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  ON_HOLD:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
};

const closetStatusColors: Record<string, string> = {
  QUOTE:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  REVIEW: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  APPROVED:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
};

function formatJobStatusLabel(status: string): string {
  if (status === "COMPLETE") return "SOLD";
  return status.replace("_", " ");
}

function formatAddress(addr: any): string | null {
  if (!addr) return null;
  const parts = [
    addr.Line1,
    addr.City,
    addr.CountrySubDivisionCode,
    addr.PostalCode,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function fmtDate(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtCurrency(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerV2DetailClient({
  customer,
  referredClients,
  userRole,
}: Props) {
  const searchParams = useSearchParams();
  const backHref = (() => {
    const query = searchParams.toString();
    return query ? `/customers-v2?${query}` : "/customers-v2";
  })();

  const address = formatAddress(customer.billAddr || customer.shipAddr);
  const isContractor = customer.type === "CONTRACTOR";
  const totalJobValue = customer.jobs.reduce(
    (sum, j) => sum + (j.value ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link
            href={backHref}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {customer.displayName}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  typeColors[customer.type] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {customer.type}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  customer.active
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {customer.active ? "Active" : "Inactive"}
              </span>
              {customer.pipedriveId && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                  Pipedrive
                </span>
              )}
              {customer.quickbooksId && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  QuickBooks
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4 flex-wrap">
          <div className="text-center px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {customer.jobs.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Jobs</p>
          </div>
          {totalJobValue > 0 && (
            <div className="text-center px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                {fmtCurrency(totalJobValue)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Total Value
              </p>
            </div>
          )}
          {isContractor && (
            <div className="text-center px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {referredClients.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Referred Clients
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Contact Information
          </h2>
          {customer.companyName && (
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Organization
                </p>
                <p className="text-gray-800 dark:text-gray-200">
                  {customer.companyName}
                </p>
              </div>
            </div>
          )}
          {customer.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Email
                </p>
                <a
                  href={`mailto:${customer.email}`}
                  className="text-teal-600 dark:text-teal-400 hover:underline"
                >
                  {customer.email}
                </a>
              </div>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Phone
                </p>
                <a
                  href={`tel:${customer.phone}`}
                  className="text-teal-600 dark:text-teal-400 hover:underline"
                >
                  {customer.phone}
                </a>
              </div>
            </div>
          )}
          {address && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Address
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 dark:text-teal-400 hover:underline"
                >
                  {address}
                </a>
              </div>
            </div>
          )}
          {customer.salesPerson && (
            <div className="flex items-start gap-3">
              <Briefcase className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Sales Person
                </p>
                <p className="text-gray-800 dark:text-gray-200">
                  {customer.salesPerson}
                </p>
              </div>
            </div>
          )}
          {/* Client referred by */}
          {!isContractor && customer.referredByOrgName && (
            <div className="flex items-start gap-3">
              <UserCheck className="w-4 h-4 text-purple-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Referred by
                </p>
                <p className="text-purple-700 dark:text-purple-300 font-medium">
                  {customer.referredByOrgName}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Account info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Account Details
          </h2>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Type
            </span>
            <span
              className={`text-sm font-medium ${
                typeColors[customer.type]?.replace(/bg-\S+ /, "") ?? ""
              }`}
            >
              {customer.type}
            </span>
          </div>
          {customer.balance !== null && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Balance
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {fmtCurrency(customer.balance)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last Synced
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {customer.lastSyncedAt ? fmtDateTime(customer.lastSyncedAt) : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Record Created
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {fmtDate(customer.createdAt)}
            </span>
          </div>
          {customer.pipedriveId && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Pipedrive ID
              </span>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {customer.pipedriveId}
              </span>
            </div>
          )}
          {customer.quickbooksId && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                QuickBooks ID
              </span>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {customer.quickbooksId}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Jobs Section */}
      {customer.jobs.length > 0 && (
        <div
          id="jobs"
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Jobs ({customer.jobs.length})
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total: {fmtCurrency(totalJobValue)}
            </span>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {customer.jobs.map((job) => (
              <div
                key={job.id}
                id={`job-${job.id}`}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    {/* Job title + number */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {job.jobNumber}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {job.jobName}
                      </span>
                      {job.jobType && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          <Tag className="w-3 h-3" />
                          {job.jobType}
                        </span>
                      )}
                    </div>

                    {/* Property address */}
                    {job.propertyAddress && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.propertyAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-teal-600 dark:hover:text-teal-400 hover:underline"
                        >
                          {job.propertyAddress}
                        </a>
                      </div>
                    )}

                    {/* Dates + value */}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {job.value !== null && (
                        <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                          <DollarSign className="w-3 h-3" />
                          {fmtCurrency(job.value)}
                        </span>
                      )}
                      {job.closeDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Closed: {fmtDate(job.closeDate)}
                        </span>
                      )}
                      {!job.closeDate && job.expectedCloseDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Expected: {fmtDate(job.expectedCloseDate)}
                        </span>
                      )}
                      {job.pipedriveId && (
                        <span className="font-mono text-gray-400">
                          PD #{job.pipedriveId}
                        </span>
                      )}
                    </div>

                    {/* External links */}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {job.quickbooksUrl && (
                        <a
                          href={job.quickbooksUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
                        >
                          <BookOpen className="w-3 h-3" />
                          QuickBooks
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {!job.quickbooksUrl && job.quickbooksJobId && (
                        <a
                          href={`https://qbo.intuit.com/app/customerdetail?nameId=${job.quickbooksJobId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
                        >
                          <BookOpen className="w-3 h-3" />
                          QuickBooks
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {job.companyCamUrl && (
                        <a
                          href={job.companyCamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Camera className="w-3 h-3" />
                          CompanyCam
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {job.notes && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                        {job.notes}
                      </p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                      jobStatusColors[job.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {formatJobStatusLabel(job.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Closet Jobs section */}
      {customer.closetJobs.length > 0 && (
        <div
          id="closet-jobs"
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Closet Jobs ({customer.closetJobs.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {customer.closetJobs.map((cj) => (
              <Link
                key={cj.id}
                href={`/closet-jobs/${cj.id}`}
                className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {cj.quoteNumber}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        · {cj.area}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {cj.propertyAddress}
                    </p>
                    {cj.quotes.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        {cj.quotes.length} quote
                        {cj.quotes.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      closetStatusColors[cj.status] ??
                      "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {cj.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Referred clients (for contractors) */}
      {isContractor && referredClients.length > 0 && (
        <div
          id="referred-clients"
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Referred Clients ({referredClients.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {referredClients.map((client) => (
              <Link
                key={client.id}
                href={`/customers-v2/${client.id}`}
                className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {client.displayName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {client.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {client.email}
                        </span>
                      )}
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {client.phone}
                        </span>
                      )}
                    </div>
                    {client.jobs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {client.jobs.slice(0, 4).map((j) => (
                          <span
                            key={j.id}
                            className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded"
                          >
                            <Hash className="w-2.5 h-2.5" />
                            {j.jobNumber}
                            {j.jobType && ` · ${j.jobType}`}
                          </span>
                        ))}
                        {client.jobs.length > 4 && (
                          <span className="text-xs text-gray-400">
                            +{client.jobs.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      client.active
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                    }`}
                  >
                    {client.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {customer.jobs.length === 0 &&
        customer.closetJobs.length === 0 &&
        referredClients.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
              No activity yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              This customer has no jobs or closet jobs associated.
            </p>
          </div>
        )}
    </div>
  );
}
