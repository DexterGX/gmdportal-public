"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ClosetJobStatus = "QUOTE" | "REVIEW" | "APPROVED" | "CANCELLED";

interface ClosetJob {
  id: string;
  quoteNumber: string;
  customerName: string;
  propertyAddress: string;
  area: string;
  status: ClosetJobStatus;
  createdAt: string;
  quotes: Array<{
    id: string;
    quoteCode: string;
    status: string;
    finalPrice: number;
  }>;
}

interface InstallerUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  active: boolean;
}

export default function ClosetJobsClient({
  userRole,
  userId,
  installers,
}: {
  userRole: string;
  userId: string;
  installers: InstallerUser[];
}) {
  const [jobs, setJobs] = useState<ClosetJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/closet-jobs");
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ClosetJobStatus) => {
    const styles = {
      QUOTE: "bg-blue-100 text-blue-800",
      REVIEW: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      CANCELLED: "bg-gray-100 text-gray-800",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status]}`}
      >
        {status}
      </span>
    );
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Closet Jobs</h1>
        {(userRole === "admin" || userRole === "sales") && (
          <button
            onClick={() => setShowNewJobModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            New Closet Job
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No closet jobs found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quote #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Area
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quotes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {job.quoteNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {job.customerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {job.propertyAddress}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getAreaLabel(job.area)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(job.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {job.quotes.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/closet-jobs/${job.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewJobModal && (
        <NewJobModal
          onClose={() => setShowNewJobModal(false)}
          onSuccess={() => {
            setShowNewJobModal(false);
            fetchJobs();
          }}
          installers={installers}
        />
      )}
    </div>
  );
}

function NewJobModal({
  onClose,
  onSuccess,
  installers,
}: {
  onClose: () => void;
  onSuccess: () => void;
  installers: InstallerUser[];
}) {
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    propertyAddress: "",
    area: "MASTER",
    installerId: "",
    notesSales: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/closet-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Error creating job:", error);
      alert("Failed to create job");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Create New Closet Job</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              required
              value={formData.customerName}
              onChange={(e) =>
                setFormData({ ...formData, customerName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Phone
            </label>
            <input
              type="tel"
              value={formData.customerPhone}
              onChange={(e) =>
                setFormData({ ...formData, customerPhone: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Address *
            </label>
            <input
              type="text"
              required
              value={formData.propertyAddress}
              onChange={(e) =>
                setFormData({ ...formData, propertyAddress: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Area Type *
              </label>
              <select
                required
                value={formData.area}
                onChange={(e) =>
                  setFormData({ ...formData, area: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="MASTER">Master Closet</option>
                <option value="GUEST">Guest Closet</option>
                <option value="GARAGE">Garage</option>
                <option value="KITCHEN">Kitchen</option>
                <option value="WALL_UNIT">Wall Unit</option>
                <option value="LAUNDRY">Laundry</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Installer *
              </label>
              <select
                required
                value={formData.installerId}
                onChange={(e) =>
                  setFormData({ ...formData, installerId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={installers.length === 0}
              >
                <option value="">
                  {installers.length === 0
                    ? "No installers available"
                    : "Select installer..."}
                </option>
                {installers.map((installer) => (
                  <option key={installer.id} value={installer.id}>
                    {installer.name || installer.id}
                  </option>
                ))}
              </select>
              {installers.length === 0 && (
                <p className="text-xs text-red-600 mt-1">
                  No installers available. Please assign the INSTALLER role to
                  users in Estimate Settings.
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sales Notes
            </label>
            <textarea
              value={formData.notesSales}
              onChange={(e) =>
                setFormData({ ...formData, notesSales: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
