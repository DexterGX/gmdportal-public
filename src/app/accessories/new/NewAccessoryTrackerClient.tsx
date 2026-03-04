"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, Calendar, AlertCircle } from "lucide-react";
import { getJobsForSelector, createAccessoryTracker } from "@/lib/accessories";
import type { AccessoryDepartment } from "@prisma/client";

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

interface Props {
  userId: string;
  userRole: string;
}

export default function NewAccessoryTrackerClient({ userId, userRole }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobDropdown, setShowJobDropdown] = useState(false);

  // Form fields
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceCreatedAt, setInvoiceCreatedAt] = useState("");
  const [remeasureApprovedAt, setRemeasureApprovedAt] = useState("");
  const [department, setDepartment] = useState<AccessoryDepartment | "">("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchTerm.length > 0) {
      fetchJobs();
    } else {
      setJobs([]);
    }
  }, [searchTerm]);

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const data = await getJobsForSelector(searchTerm);
      setJobs(data);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedJob) {
      setError("Please select a job");
      return;
    }

    setSubmitting(true);

    try {
      const tracker = await createAccessoryTracker({
        jobId: selectedJob.id,
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceCreatedAt: invoiceCreatedAt
          ? new Date(invoiceCreatedAt)
          : undefined,
        remeasureApprovedAt: remeasureApprovedAt
          ? new Date(remeasureApprovedAt)
          : undefined,
        department: department || undefined,
        notes: notes || undefined,
        createdByUserId: userId,
      });

      router.push(`/accessories/${tracker.id}`);
    } catch (error: any) {
      console.error("Error creating tracker:", error);
      setError(error.message || "Failed to create tracker");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-3xl font-bold">New Accessory Tracker</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Create a tracker to manage accessory purchases for a job
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-300">
                {error}
              </div>
            </div>
          )}

          {/* Job Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Job <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for a job..."
                  value={selectedJob ? "" : searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowJobDropdown(true);
                  }}
                  onFocus={() => setShowJobDropdown(true)}
                  disabled={!!selectedJob}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                />
              </div>

              {/* Selected Job Display */}
              {selectedJob && (
                <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        Job #{selectedJob.jobNumber} - {selectedJob.jobName}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {selectedJob.customer.displayName}
                        {selectedJob.customer.companyName &&
                          ` (${selectedJob.customer.companyName})`}
                      </div>
                      {selectedJob.customer.phone && (
                        <div className="text-sm text-gray-500 dark:text-gray-500">
                          {selectedJob.customer.phone}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJob(null);
                        setSearchTerm("");
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              {/* Job Dropdown */}
              {showJobDropdown && !selectedJob && searchTerm.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                  {loadingJobs ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      Loading...
                    </div>
                  ) : jobs.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      No jobs found
                    </div>
                  ) : (
                    jobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          setSelectedJob(job);
                          setShowJobDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Job #{job.jobNumber} - {job.jobName}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {job.customer.displayName}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Milestone Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Invoice #
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Optional"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Invoice Created
              </label>
              <input
                type="date"
                value={invoiceCreatedAt}
                onChange={(e) => setInvoiceCreatedAt(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Remeasure Approved
              </label>
              <input
                type="date"
                value={remeasureApprovedAt}
                onChange={(e) => setRemeasureApprovedAt(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Department */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Department
            </label>
            <select
              value={department}
              onChange={(e) =>
                setDepartment(e.target.value as AccessoryDepartment | "")
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select department...</option>
              <option value="CABINETS">Cabinets</option>
              <option value="COUNTERTOPS">Countertops</option>
              <option value="BOTH">Both</option>
            </select>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add any additional notes..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedJob}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating..." : "Create Tracker"}
          </button>
        </div>
      </form>
    </div>
  );
}
