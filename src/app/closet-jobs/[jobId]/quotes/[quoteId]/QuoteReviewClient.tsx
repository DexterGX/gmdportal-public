"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface QuoteDetail {
  id: string;
  quoteCode: string;
  color: string;
  installerCost: string;
  gmFactor: string | null;
  finalPrice: string;
  notesInstaller: string | null;
  notesSales: string | null;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: { id: string; name: string | null } | null;
  lastPrintedAt: string | null;
  files: Array<{
    id: string;
    fileUrl: string;
    type: string;
    caption: string | null;
  }>;
  closetJob: {
    id: string;
    quoteNumber: string;
    customerName: string;
    customerPhone: string | null;
    propertyAddress: string;
    area: string;
    status: string;
    createdAt: string;
    salesPerson: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
    installer: { id: string; name: string | null; email: string | null } | null;
  };
}

export default function QuoteReviewClient({
  quote,
  userRole,
}: {
  quote: QuoteDetail;
  userRole: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [gmFactor, setGmFactor] = useState(quote.gmFactor || "1.35");
  const [finalPrice, setFinalPrice] = useState(quote.finalPrice);
  const [notesSales, setNotesSales] = useState(quote.notesSales || "");
  const [saving, setSaving] = useState(false);

  const calculatedPrice = (
    parseFloat(quote.installerCost) * parseFloat(gmFactor)
  ).toFixed(2);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/closet-jobs/${quote.closetJob.id}/quotes/${quote.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gmFactor: parseFloat(gmFactor),
            finalPrice: parseFloat(finalPrice),
            notesSales,
          }),
        }
      );

      if (response.ok) {
        setEditing(false);
        router.refresh();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Error saving quote:", error);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (
      !confirm(
        "Are you sure you want to approve this quote? This will mark the job as approved."
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/closet-jobs/${quote.closetJob.id}/quotes/${quote.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "APPROVED",
          }),
        }
      );

      if (response.ok) {
        router.refresh();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Error approving quote:", error);
      alert("Failed to approve quote");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Are you sure you want to reject this quote?")) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/closet-jobs/${quote.closetJob.id}/quotes/${quote.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "REJECTED",
          }),
        }
      );

      if (response.ok) {
        router.refresh();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Error rejecting quote:", error);
      alert("Failed to reject quote");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-3 py-1 text-sm font-semibold rounded-full ${
          styles[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const margin =
    userRole === "admin"
      ? ((parseFloat(finalPrice) - parseFloat(quote.installerCost)) /
          parseFloat(finalPrice)) *
        100
      : 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/closet-jobs/${quote.closetJob.id}`}
          className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          ← Back to Job
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{quote.quoteCode}</h1>
            <p className="text-gray-600 mt-1">
              {quote.closetJob.quoteNumber} - {quote.closetJob.customerName}
            </p>
          </div>
          {getStatusBadge(quote.status)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Quote Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Quote Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Color / Finish</p>
                <p className="font-medium">{quote.color}</p>
              </div>

              {userRole === "admin" && (
                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div>
                    <p className="text-sm text-gray-500">Installer Cost</p>
                    <p className="font-medium text-lg">
                      ${parseFloat(quote.installerCost).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Margin</p>
                    <p className="font-medium text-lg">{margin.toFixed(1)}%</p>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t">
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        GM Factor
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={gmFactor}
                        onChange={(e) => {
                          setGmFactor(e.target.value);
                          setFinalPrice(
                            (
                              parseFloat(quote.installerCost) *
                              parseFloat(e.target.value)
                            ).toFixed(2)
                          );
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Calculated price: ${calculatedPrice}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Final Price (Override)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={finalPrice}
                          onChange={(e) => setFinalPrice(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500">Final Client Price</p>
                    <p className="font-bold text-2xl text-green-600">
                      ${parseFloat(finalPrice).toFixed(2)}
                    </p>
                    {quote.gmFactor && (
                      <p className="text-xs text-gray-500 mt-1">
                        Factor: {parseFloat(quote.gmFactor).toFixed(2)}x
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Notes</h2>
            {quote.notesInstaller && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  From Installer
                </p>
                <p className="text-gray-600 bg-gray-50 p-3 rounded">
                  {quote.notesInstaller}
                </p>
              </div>
            )}
            {editing ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sales Notes
                </label>
                <textarea
                  value={notesSales}
                  onChange={(e) => setNotesSales(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            ) : (
              quote.notesSales && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Sales Notes
                  </p>
                  <p className="text-gray-600 bg-blue-50 p-3 rounded">
                    {quote.notesSales}
                  </p>
                </div>
              )
            )}
          </div>

          {/* 3D Renders */}
          {quote.files.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                3D Renders & Images
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {quote.files.map((file) => (
                  <div key={file.id} className="space-y-2">
                    <img
                      src={file.fileUrl}
                      alt={file.caption || "Render"}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    {file.caption && (
                      <p className="text-sm text-gray-600">{file.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Actions</h3>
            <div className="space-y-2">
              {quote.status === "PENDING_REVIEW" && (
                <>
                  {editing ? (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        disabled={saving}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditing(true)}
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                      >
                        Edit Price
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={saving}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve Quote
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={saving}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject Quote
                      </button>
                    </>
                  )}
                </>
              )}
              <Link
                href={`/closet-jobs/${quote.closetJob.id}/quotes/${quote.id}/print?auto=1`}
                target="_blank"
                className="block w-full px-4 py-2 bg-blue-100 text-blue-700 text-center rounded-md hover:bg-blue-200"
              >
                Print Quote
              </Link>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Timeline</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Created</p>
                <p className="font-medium">
                  {new Date(quote.createdAt).toLocaleString()}
                </p>
              </div>
              {quote.submittedAt && (
                <div>
                  <p className="text-gray-500">Submitted</p>
                  <p className="font-medium">
                    {new Date(quote.submittedAt).toLocaleString()}
                  </p>
                </div>
              )}
              {quote.approvedAt && (
                <div>
                  <p className="text-gray-500">Approved</p>
                  <p className="font-medium">
                    {new Date(quote.approvedAt).toLocaleString()}
                  </p>
                  {quote.approvedBy && (
                    <p className="text-xs text-gray-600">
                      by {quote.approvedBy.name || "Unknown"}
                    </p>
                  )}
                </div>
              )}
              {quote.lastPrintedAt && (
                <div>
                  <p className="text-gray-500">Last Printed</p>
                  <p className="font-medium">
                    {new Date(quote.lastPrintedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Project Info */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Project Info</h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-500">Customer</p>
                <p className="font-medium">{quote.closetJob.customerName}</p>
              </div>
              <div>
                <p className="text-gray-500">Address</p>
                <p className="font-medium">{quote.closetJob.propertyAddress}</p>
              </div>
              <div>
                <p className="text-gray-500">Installer</p>
                <p className="font-medium">
                  {quote.closetJob.installer?.name || "Unknown"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
