"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  DollarSign,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Plus,
} from "lucide-react";
import type { Customer, Job, JobArtifact, ClosetJob } from "@prisma/client";

type JobWithDetails = Omit<Job, "value"> & {
  value: number | null;
  jobNumber: number;
  customer: Omit<Customer, "balance"> & {
    balance: number | null;
  };
  closetJob: (ClosetJob & {
    quotes: Array<{
      id: string;
      quoteCode: string;
      status: string;
      installerCost: number;
      gmFactor: number | null;
      finalPrice: number;
    }>;
  }) | null;
  artifacts: JobArtifact[];
};

interface Props {
  job: JobWithDetails;
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

export default function JobDetailClient({ job, userRole }: Props) {
  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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

  const linksByType = {
    files: job.artifacts.filter((a) => a.type === "FILE"),
    links: job.artifacts.filter((a) => a.type === "LINK"),
    notes: job.artifacts.filter((a) => a.type === "NOTE"),
    snapshots: job.artifacts.filter((a) => a.type === "SNAPSHOT"),
  };

  const jobAddress = formatAddress(job.customer.billAddr || job.customer.shipAddr);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/customers/${job.customer.id}`}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {job.jobName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Job #<span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{job.jobNumber}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {job.pipedriveId && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
              Pipedrive
            </span>
          )}
          {job.quickbooksJobId && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              QuickBooks
            </span>
          )}
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[job.status]}`}
          >
            {job.status}
          </span>
        </div>
      </div>

        {/* Customer Link */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Briefcase className="w-4 h-4" />
            <span>Customer:</span>
            <Link
              href={`/customers/${job.customer.id}`}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {job.customer.displayName}
            </Link>
          </div>
        </div>

      {/* Contact Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Contact Information
          </h2>
          <div className="space-y-3">
            {job.customer.displayName && (
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-gray-400" />
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    Contact Name:
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {job.customer.displayName}
                  </span>
                </div>
              </div>
            )}
            {job.customer.email && (
              <div className="flex items-center gap-3">
                <LinkIcon className="w-4 h-4 text-gray-400" />
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    Email:
                  </span>
                  <a
                    href={`mailto:${job.customer.email}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {job.customer.email}
                  </a>
                </div>
              </div>
            )}
            {job.customer.phone && (
              <div className="flex items-center gap-3">
                <LinkIcon className="w-4 h-4 text-gray-400" />
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    Phone:
                  </span>
                  <a
                    href={`tel:${job.customer.phone}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {job.customer.phone}
                  </a>
                </div>
              </div>
            )}
            {jobAddress && (
              <div className="flex items-start gap-3">
                <LinkIcon className="w-4 h-4 text-gray-400 mt-1" />
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    Job Address:
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {jobAddress}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Job Value & Dates */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Job Details
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Job Value:
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(job.value)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Created:
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {formatDate(job.createdAt)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Last Updated:
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {formatDate(job.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Closet Job Section */}
      {job.closetJob && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Closet/Cabinet Project
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Quote Number:
              </span>
              <Link
                href={`/closet-jobs/${job.closetJob.id}`}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {job.closetJob.quoteNumber}
              </Link>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Status:
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {job.closetJob.status}
              </span>
            </div>
            {job.closetJob.quotes.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Recent Quotes:
                </p>
                <div className="space-y-2">
                  {job.closetJob.quotes.map((quote) => (
                    <Link
                      key={quote.id}
                      href={`/closet-jobs/${job.closetJob!.id}/quotes/${quote.id}`}
                      className="block p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {quote.quoteCode}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {formatCurrency(quote.finalPrice)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

        {/* Artifacts Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Artifacts & Links
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Links and files will appear here when added from other modules
          </p>
          {linksByType.links.length > 0 && (
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Links
              </h3>
              <div className="space-y-2">
                {linksByType.links.map((artifact) => (
                  <a
                    key={artifact.id}
                    href={artifact.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <LinkIcon className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {artifact.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {artifact.sourceApp} · {formatDate(artifact.createdAt)}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {linksByType.files.length > 0 && (
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Files
              </h3>
              <div className="space-y-2">
                {linksByType.files.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {artifact.fileName || artifact.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {artifact.sourceApp} · {formatDate(artifact.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {job.artifacts.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No artifacts or links yet
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Add links to estimates, files, or other resources
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notes Section */}
      {job.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Notes
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {job.notes}
          </p>
        </div>
      )}
    </div>
  );
}
