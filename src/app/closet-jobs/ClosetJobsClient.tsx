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
  areas?: string[];
  notesSales?: string | null;
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

const areaOptions = [
  { value: "MASTER", label: "Master Closet" },
  { value: "GUEST", label: "Guest Closet" },
  { value: "GARAGE", label: "Garage" },
  { value: "KITCHEN", label: "Kitchen" },
  { value: "WALL_UNIT", label: "Wall Unit" },
  { value: "LAUNDRY", label: "Laundry" },
  { value: "OTHER", label: "Other" },
];

export default function ClosetJobsClient({
  userRole,
  userId,
  installers,
  salesUsers,
}: {
  userRole: string;
  userId: string;
  installers: InstallerUser[];
  salesUsers: InstallerUser[];
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

  const getJobAreasLabel = (job: ClosetJob) => {
    const parsedAreas = getAreasFromNotes(job.notesSales);
    return getAreasLabel(job.areas?.length ? job.areas : parsedAreas, job.area);
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
        <div className="space-y-4">
          <div className="md:hidden space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Quote #</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {job.quoteNumber}
                    </p>
                  </div>
                  {getStatusBadge(job.status)}
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Customer</p>
                    <p className="text-gray-900">{job.customerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="text-gray-900 break-words">{job.propertyAddress}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Area</p>
                      <p className="text-gray-900">{getJobAreasLabel(job)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Quotes</p>
                      <p className="text-gray-900">{job.quotes.length}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-gray-900">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Link
                    href={`/closet-jobs/${job.id}`}
                    className="inline-flex w-full justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full divide-y divide-gray-200">
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
                    <td className="px-6 py-4 text-sm text-gray-900 min-w-[180px]">
                      {getJobAreasLabel(job)}
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
          </div>
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
          salesUsers={salesUsers}
          currentUserId={userId}
        />
      )}
    </div>
  );
}

function NewJobModal({
  onClose,
  onSuccess,
  installers,
  salesUsers,
  currentUserId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  installers: InstallerUser[];
  salesUsers: InstallerUser[];
  currentUserId: string;
}) {
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    propertyAddress: "",
    areas: ["MASTER"],
    installerId: "",
    salesPersonId: currentUserId,
    notesSales: "",
  });
  const [customArea, setCustomArea] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleArea = (areaValue: string) => {
    const selected = formData.areas.includes(areaValue);
    setFormData({
      ...formData,
      areas: selected
        ? formData.areas.filter((item) => item !== areaValue)
        : [...formData.areas, areaValue],
    });
  };

  const addCustomArea = () => {
    const cleaned = customArea.trim();
    if (!cleaned) {
      return;
    }

    if (formData.areas.includes(cleaned)) {
      setCustomArea("");
      return;
    }

    setFormData({
      ...formData,
      areas: [...formData.areas, cleaned],
    });
    setCustomArea("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.areas.length === 0) {
      alert("Please select at least one area.");
      return;
    }

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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sales Person *
              </label>
              <select
                required
                value={formData.salesPersonId}
                onChange={(e) =>
                  setFormData({ ...formData, salesPersonId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={salesUsers.length === 0}
              >
                <option value="">
                  {salesUsers.length === 0
                    ? "No sales users available"
                    : "Select sales person..."}
                </option>
                {salesUsers.map((salesUser) => (
                  <option key={salesUser.id} value={salesUser.id}>
                    {salesUser.name || salesUser.email || salesUser.id}
                  </option>
                ))}
              </select>
              {salesUsers.length === 0 && (
                <p className="text-xs text-red-600 mt-1">
                  No active sales users available. Please assign SALES or ADMIN
                  roles.
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Areas *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {areaOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={formData.areas.includes(option.value)}
                    onChange={() => toggleArea(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customArea}
                onChange={(e) => setCustomArea(e.target.value)}
                placeholder="Add custom area (e.g., Boys Room)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <button
                type="button"
                onClick={addCustomArea}
                className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Add
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {formData.areas.map((areaItem) => (
                <button
                  key={areaItem}
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      areas: formData.areas.filter((item) => item !== areaItem),
                    })
                  }
                  className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200"
                >
                  {areaOptions.find((option) => option.value === areaItem)
                    ?.label || areaItem}
                  <span className="ml-1">x</span>
                </button>
              ))}
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
