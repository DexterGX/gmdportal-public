"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface ClosetJobDetail {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerPhone?: string | null;
  propertyAddress: string;
  area: string;
  areas?: string[];
  status: string;
  createdAt: string;
  notesSales?: string | null;
  salesPerson: { id: string; name: string | null; email: string | null } | null;
  installer: { id: string; name: string | null; email: string | null } | null;
  quotes: Array<{
    id: string;
    quoteCode: string;
    color: string;
    installerCost: string;
    gmFactor: string | null;
    finalPrice: string;
    status: string;
    createdAt: string;
    submittedAt: string | null;
    approvedAt: string | null;
    installer: { id: string; name: string | null; email: string | null } | null;
    submittedBy: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
    approvedBy: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
    files: Array<{
      id: string;
      fileUrl: string;
      type: string;
      caption: string | null;
    }>;
  }>;
}

export default function ClosetJobDetailClient({
  job,
  userRole,
  userId,
}: {
  job: ClosetJobDetail;
  userRole: string;
  userId: string;
}) {
  const router = useRouter();

  const getAreaLabel = (area: string) => {
    const labels: Record<string, string> = {
      MASTER: "Master Closet",
      GUEST: "Guest Closet",
      GARAGE: "Garage",
      KITCHEN: "Kitchen",
      WALL_UNIT: "Wall Unit",
      LAUNDRY: "Laundry",
      OTHER: "Other",
    };
    return labels[area] || area;
  };

  const getAreasLabel = (areas?: string[], fallbackArea?: string) => {
    const normalized = (areas || []).filter(Boolean);
    if (normalized.length === 0) {
      return fallbackArea ? getAreaLabel(fallbackArea) : "Other";
    }

    return normalized.map((item) => getAreaLabel(item)).join(", ");
  };

  const getAreasFromNotes = (notes?: string | null) => {
    if (!notes) {
      return [];
    }

    const line = notes
      .split("\n")
      .find((item) => item.trim().toLowerCase().startsWith("areas:"));

    if (!line) {
      return [];
    }

    return line
      .split(":")
      .slice(1)
      .join(":")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      QUOTE: "bg-blue-100 text-blue-800",
      REVIEW: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      CANCELLED: "bg-gray-100 text-gray-800",
      PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
      REJECTED: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          styles[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const canCreateQuote =
    (userRole === "installer" && job.installer?.id === userId) ||
    userRole === "admin";
  const canReviewQuotes = userRole === "admin" || userRole === "sales";

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/closet-jobs"
          className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          ← Back to Jobs
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h1 className="text-2xl sm:text-3xl font-bold break-words">{job.quoteNumber}</h1>
          {getStatusBadge(job.status)}
        </div>
      </div>

      {/* Job Information */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Job Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Customer</p>
            <p className="font-medium">{job.customerName}</p>
            {job.customerPhone && (
              <p className="text-sm text-gray-600">{job.customerPhone}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">Property Address</p>
            <p className="font-medium break-words">{job.propertyAddress}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Area</p>
            <p className="font-medium">
              {getAreasLabel(
                job.areas?.length ? job.areas : getAreasFromNotes(job.notesSales),
                job.area
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="font-medium">
              {new Date(job.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Sales Person</p>
            <p className="font-medium">{job.salesPerson?.name || "Unknown"}</p>
            {job.salesPerson?.email && (
              <p className="text-sm text-gray-600">{job.salesPerson.email}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">Installer</p>
            <p className="font-medium">{job.installer?.name || "Unknown"}</p>
            {job.installer?.email && (
              <p className="text-sm text-gray-600">{job.installer.email}</p>
            )}
          </div>
        </div>
        {job.notesSales && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">Sales Notes</p>
            <p className="text-gray-700">{job.notesSales}</p>
          </div>
        )}
      </div>

      {/* Quotes Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
          <h2 className="text-xl font-semibold">
            Quotes ({job.quotes.length})
          </h2>
          {canCreateQuote && (
            <Link
              href={`/closet-jobs/${job.id}/new-quote`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center"
            >
              Submit New Quote
            </Link>
          )}
        </div>

        {job.quotes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No quotes submitted yet
          </p>
        ) : (
          <div className="space-y-4">
            {job.quotes.map((quote) => (
              <div
                key={quote.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg break-words">{quote.quoteCode}</h3>
                    <p className="text-sm text-gray-600">
                      Color: {quote.color}
                    </p>
                    {quote.installer && (
                      <p className="text-xs text-gray-500 mt-1">
                        Installer: {quote.installer.name}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(quote.status)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
                  {/* ADMIN sees installer cost, GM factor, and final price */}
                  {userRole === "admin" && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500">Installer Cost</p>
                        <p className="font-medium">
                          ${parseFloat(quote.installerCost).toFixed(2)}
                        </p>
                      </div>
                      {quote.gmFactor && (
                        <div>
                          <p className="text-xs text-gray-500">GM Factor</p>
                          <p className="font-medium">
                            {parseFloat(quote.gmFactor).toFixed(2)}x
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500">Final Price</p>
                        <p className="font-medium text-lg text-green-600">
                          ${parseFloat(quote.finalPrice).toFixed(2)}
                        </p>
                      </div>
                    </>
                  )}
                  {/* SALES sees only final price */}
                  {userRole === "sales" && (
                    <div>
                      <p className="text-xs text-gray-500">Final Price</p>
                      <p className="font-medium text-lg">
                        ${parseFloat(quote.finalPrice).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {/* INSTALLER sees only their submitted price */}
                  {userRole === "installer" && (
                    <div>
                      <p className="text-xs text-gray-500">Submitted Price</p>
                      <p className="font-medium text-lg">
                        ${parseFloat(quote.installerCost).toFixed(2)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Submitted</p>
                    <p className="text-sm">
                      {quote.submittedAt
                        ? new Date(quote.submittedAt).toLocaleDateString()
                        : "Not submitted"}
                    </p>
                    {quote.submittedBy && (
                      <p className="text-xs text-gray-500">
                        by {quote.submittedBy.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Show approved by info if quote is approved */}
                {quote.approvedAt && quote.approvedBy && (
                  <div className="mb-3 p-2 bg-green-50 rounded text-sm">
                    <span className="text-green-700 font-medium">
                      Approved by {quote.approvedBy.name}
                    </span>
                    <span className="text-gray-600 ml-2">
                      on {new Date(quote.approvedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {quote.files.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-2">
                      3D Renders ({quote.files.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {quote.files.slice(0, 4).map((file) => (
                        <a
                          key={file.id}
                          href={file.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={file.fileUrl}
                            alt={file.caption || "3D render"}
                            className="w-full h-24 object-cover rounded"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {canReviewQuotes && (
                    <Link
                      href={`/closet-jobs/${job.id}/quotes/${quote.id}`}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                    >
                      Review
                    </Link>
                  )}
                  {(userRole === "admin" || userRole === "sales") && (
                    <Link
                      href={`/closet-jobs/${job.id}/quotes/${quote.id}/print?auto=1`}
                      target="_blank"
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                    >
                      Print Quote
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
