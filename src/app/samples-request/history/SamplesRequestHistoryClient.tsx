"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ClipboardList } from "lucide-react";
import { useSidebar } from "@/context/SidebarContext";
import {
  getSampleRequestHistory,
  type SampleRequestHistoryWithRelations,
  type SampleRequestStatus,
} from "@/lib/samplesRequests";

export default function SamplesRequestHistoryClient() {
  const { isMobileOpen, isMobile } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SampleRequestHistoryWithRelations[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<SampleRequestStatus | "">(
    "",
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getSampleRequestHistory({
          search: searchTerm.trim() || undefined,
          status: statusFilter || undefined,
        });
        if (active) setEvents(data);
      } catch (error) {
        console.error("Error loading sample request history:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(load, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm, statusFilter]);

  const handlePrint = () => {
    setTimeout(() => window.print(), 50);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
  };

  const emptyState = useMemo(
    () => !loading && events.length === 0,
    [loading, events.length],
  );

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
          <h1 className="text-3xl font-bold">Samples Request History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track status changes for sample requests
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          Print history
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search client, job, brand, color"
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
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Clear filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-10 text-center text-gray-500">
          Loading history...
        </div>
      ) : emptyState ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-10 text-center text-gray-500">
          <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          No history entries yet.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Client / Job
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status Change
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {events.map((event) => {
                  const clientName =
                    event.request.job?.customer.displayName ||
                    event.request.customer?.displayName ||
                    "—";
                  const jobLabel = event.request.job
                    ? `Job #${event.request.job.jobNumber} — ${event.request.job.jobName}`
                    : event.request.jobName || "—";
                  return (
                    <tr key={event.id}>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        <div>{new Date(event.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(event.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {clientName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {jobLabel}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {event.fromStatus
                          ? `${event.fromStatus.replace(/_/g, " ")} → ${
                              event.toStatus?.replace(/_/g, " ")
                            }`
                          : event.toStatus?.replace(/_/g, " ") || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {event.message || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {event.changedByUser?.name || "System"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
