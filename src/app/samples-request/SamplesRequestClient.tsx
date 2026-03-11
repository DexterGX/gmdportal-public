"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, ClipboardList, X, AlertCircle } from "lucide-react";
import { useSidebar } from "@/context/SidebarContext";
import {
  createSampleRequest,
  getSampleRequests,
  type SampleRequestWithRelations,
  type SampleRequestStatus,
  type SampleRequestType,
  type SampleRequestProvider,
} from "@/lib/samplesRequests";
import { getJobSelectorOptions } from "@/lib/accessories";

interface Props {
  userId: string;
  userName: string;
  userRole: string;
  providers: SampleRequestProvider[];
}

interface Job {
  id: string;
  jobNumber: number;
  jobName: string;
  status: string;
  customer: {
    id: string;
    displayName: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
  };
}

interface Customer {
  id: string;
  displayName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
}

const statusStyles: Record<SampleRequestStatus, string> = {
  REQUESTED: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  ORDERED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELED: "bg-red-100 text-red-800",
};

export default function SamplesRequestClient({
  userId,
  userName,
  userRole,
  providers,
}: Props) {
  const router = useRouter();
  const { isMobileOpen, isMobile } = useSidebar();
  const [requests, setRequests] = useState<SampleRequestWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<SampleRequestStatus | "">(
    "",
  );
  const [typeFilter, setTypeFilter] = useState<SampleRequestType | "">("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [notification, setNotification] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();

  const [jobSearch, setJobSearch] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [jobName, setJobName] = useState("");
  const [showJobDropdown, setShowJobDropdown] = useState(false);

  const [sampleType, setSampleType] = useState<SampleRequestType | "">("");
  const [brand, setBrand] = useState("");
  const [colorName, setColorName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const brandOptions = useMemo(() => {
    if (!sampleType) return [];
    return providers
      .filter(
        (provider) => provider.sampleType === sampleType && provider.isActive,
      )
      .map((provider) => provider.name);
  }, [providers, sampleType]);

  const canManage = ["admin", "sales", "office"].includes(userRole);

  useEffect(() => {
    fetchRequests();
  }, [searchTerm, statusFilter, typeFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await getSampleRequests({
        search: searchTerm.trim() || undefined,
        status: statusFilter || undefined,
        sampleType: typeFilter || undefined,
      });
      setRequests(data);
    } catch (error) {
      console.error("Error fetching sample requests:", error);
      setNotification({ type: "error", message: "Failed to load requests." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobSearch.length > 0) {
      fetchJobOptions();
    } else {
      setJobs([]);
      setCustomers([]);
    }
  }, [jobSearch]);

  const fetchJobOptions = async () => {
    setLoadingJobs(true);
    try {
      const data = await getJobSelectorOptions(jobSearch);
      setJobs(data.jobs);
      setCustomers(data.customers);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  };

  const resetForm = () => {
    setSelectedJob(null);
    setSelectedCustomer(null);
    setJobName("");
    setJobSearch("");
    setSampleType("");
    setBrand("");
    setColorName("");
    setQuantity(1);
    setNotes("");
    setShowJobDropdown(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;

    if (!selectedJob && !selectedCustomer) {
      setNotification({ type: "error", message: "Select a client/job first." });
      return;
    }

    if (selectedCustomer && !jobName.trim()) {
      setNotification({
        type: "error",
        message: "Please enter the job name.",
      });
      return;
    }

    if (!sampleType) {
      setNotification({ type: "error", message: "Select a sample type." });
      return;
    }

    if (!brand.trim()) {
      setNotification({ type: "error", message: "Select a brand." });
      return;
    }

    if (!colorName.trim()) {
      setNotification({ type: "error", message: "Enter a color name." });
      return;
    }

    if (!quantity || quantity < 1) {
      setNotification({
        type: "error",
        message: "Quantity must be 1 or more.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await createSampleRequest({
        jobId: selectedJob?.id,
        customerId: selectedJob
          ? selectedJob.customer.id
          : selectedCustomer?.id,
        jobName: selectedJob ? selectedJob.jobName : jobName.trim(),
        sampleType,
        brand,
        colorName: colorName.trim(),
        quantity,
        notes: notes.trim() || undefined,
        requestedByUserId: userId,
      });
      setNotification({ type: "success", message: "Request created." });
      setShowNewModal(false);
      resetForm();
      fetchRequests();
    } catch (error: any) {
      console.error("Error creating request:", error);
      setNotification({
        type: "error",
        message: error?.message || "Failed to create request.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setTypeFilter("");
  };

  const handlePrint = () => {
    setTimeout(() => window.print(), 50);
  };

  const emptyState = !loading && requests.length === 0;

  return (
    <div
      className={`max-w-7xl mx-auto transition-opacity ${
        isMobile && isMobileOpen
          ? "opacity-0 pointer-events-none"
          : "opacity-100"
      }`}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Samples Request</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage cabinet and countertop sample requests
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Request
          </button>
        )}
      </div>

      {notification && (
        <div
          className={`mb-4 rounded-md border p-3 text-sm flex items-center justify-between ${
            notification.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(undefined)}
            className="text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search client, job, brand, color"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as SampleRequestStatus | "")
            }
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="REQUESTED">Requested</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ORDERED">Ordered</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELED">Canceled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as SampleRequestType | "")
            }
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="CABINET">Cabinet</option>
            <option value="COUNTERTOP">Countertop</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Print list
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-10 text-center text-gray-500">
          Loading requests...
        </div>
      ) : emptyState ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-10 text-center text-gray-500">
          <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          No sample requests yet.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Client / Job
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Brand / Color
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Requested By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {requests.map((request) => {
                  const clientName =
                    request.job?.customer.displayName ||
                    request.customer?.displayName ||
                    "—";
                  const jobLabel = request.job
                    ? `Job #${request.job.jobNumber} — ${request.job.jobName}`
                    : request.jobName || "—";
                  return (
                    <tr
                      key={request.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/40 cursor-pointer"
                      onClick={() =>
                        router.push(`/samples-request/${request.id}`)
                      }
                    >
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            statusStyles[request.status]
                          }`}
                        >
                          {request.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {clientName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {jobLabel}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                        {request.sampleType}
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                        <div className="font-medium">{request.brand}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {request.colorName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                        {request.quantity}
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                        {request.requestedByUser?.name || "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                New Sample Request
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowNewModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client / Job
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search for a job or customer..."
                    value={selectedJob || selectedCustomer ? "" : jobSearch}
                    onChange={(e) => {
                      setJobSearch(e.target.value);
                      setShowJobDropdown(true);
                    }}
                    onFocus={() => setShowJobDropdown(true)}
                    disabled={!!selectedJob || !!selectedCustomer}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                  />
                </div>

                {selectedJob && (
                  <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          Job #{selectedJob.jobNumber} - {selectedJob.jobName}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {selectedJob.customer.displayName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJob(null);
                          setJobSearch("");
                          setJobName("");
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}

                {selectedCustomer && (
                  <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {selectedCustomer.displayName}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {selectedCustomer.companyName &&
                            `(${selectedCustomer.companyName})`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setJobSearch("");
                          setJobName("");
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}

                {showJobDropdown && !selectedJob && !selectedCustomer && (
                  <div className="absolute z-20 mt-2 w-full max-h-64 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                    {loadingJobs ? (
                      <div className="p-4 text-sm text-gray-500">
                        Loading...
                      </div>
                    ) : (
                      <>
                        {jobs.length > 0 && (
                          <div className="px-4 py-2 text-xs uppercase tracking-wide text-gray-400">
                            Jobs
                          </div>
                        )}
                        {jobs.map((job) => (
                          <button
                            key={job.id}
                            type="button"
                            onClick={() => {
                              setSelectedJob(job);
                              setSelectedCustomer(null);
                              setShowJobDropdown(false);
                              setJobSearch("");
                              setJobName("");
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              Job #{job.jobNumber} - {job.jobName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {job.customer.displayName}
                            </div>
                          </button>
                        ))}
                        {customers.length > 0 && (
                          <div className="px-4 py-2 text-xs uppercase tracking-wide text-gray-400">
                            Customers
                          </div>
                        )}
                        {customers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setSelectedJob(null);
                              setShowJobDropdown(false);
                              setJobSearch("");
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {customer.displayName}
                            </div>
                            {customer.companyName && (
                              <div className="text-xs text-gray-500">
                                {customer.companyName}
                              </div>
                            )}
                          </button>
                        ))}
                        {jobs.length === 0 && customers.length === 0 && (
                          <div className="p-4 text-sm text-gray-500">
                            No results found.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {selectedCustomer && !selectedJob && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Job Name
                  </label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter job name"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sample Type
                  </label>
                  <select
                    value={sampleType}
                    onChange={(e) => {
                      setSampleType(e.target.value as SampleRequestType);
                      setBrand("");
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select type</option>
                    <option value="CABINET">Cabinet</option>
                    <option value="COUNTERTOP">Countertop</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Brand
                  </label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    disabled={!sampleType}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700"
                  >
                    <option value="">Select brand</option>
                    {sampleType && brandOptions.length === 0 && (
                      <option value="" disabled>
                        No providers configured
                      </option>
                    )}
                    {brandOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color Name
                  </label>
                  <input
                    type="text"
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Requested By
                </label>
                <input
                  type="text"
                  value={userName}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
