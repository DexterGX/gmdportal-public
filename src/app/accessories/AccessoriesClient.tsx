"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  AlertCircle,
  Package,
  Calendar,
  User,
  Clock,
} from "lucide-react";
import { getAccessoryTrackers } from "@/lib/accessories";
import { useSidebar } from "@/context/SidebarContext";
import type {
  AccessoryTrackerWithRelations,
  AccessoryItemWithUser,
} from "@/lib/accessories";
import type { AccessoryItemStatus, AccessoryDepartment } from "@prisma/client";

interface Props {
  userRole: string;
  userId: string;
}

export default function AccessoriesClient({ userRole, userId }: Props) {
  const router = useRouter();
  const { isMobileOpen, isMobile } = useSidebar();
  const [trackers, setTrackers] = useState<AccessoryTrackerWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<AccessoryItemStatus | "">(
    "",
  );
  const [filterDepartment, setFilterDepartment] = useState<
    AccessoryDepartment | ""
  >("");
  const [filterNeedsAttention, setFilterNeedsAttention] = useState(false);

  useEffect(() => {
    fetchTrackers();
  }, [searchTerm, filterStatus, filterDepartment, filterNeedsAttention]);

  const fetchTrackers = async () => {
    setLoading(true);
    try {
      const data = await getAccessoryTrackers({
        search: searchTerm || undefined,
        status: filterStatus || undefined,
        department: filterDepartment || undefined,
        needsAttention: filterNeedsAttention || undefined,
      });
      setTrackers(data);
    } catch (error) {
      console.error("Error fetching trackers:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusCounts = (items: AccessoryItemWithUser[]) => {
    const counts = {
      readyToOrder: 0,
      ordered: 0,
      delivered: 0,
      installed: 0,
      issue: 0,
    };

    items.forEach((item) => {
      switch (item.status) {
        case "READY_TO_ORDER":
        case "PENDING_REMEASURE_APPROVAL":
          counts.readyToOrder++;
          break;
        case "ORDERED":
        case "IN_TRANSIT":
          counts.ordered++;
          break;
        case "DELIVERED":
        case "CHECKED_IN":
          counts.delivered++;
          break;
        case "INSTALLED":
          counts.installed++;
          break;
        case "ISSUE":
          counts.issue++;
          break;
      }
    });

    return counts;
  };

  const needsAttention = (items: AccessoryItemWithUser[]) => {
    return items.some(
      (item) =>
        item.status === "ISSUE" ||
        (item.etaAt &&
          item.etaAt < new Date() &&
          !["DELIVERED", "CHECKED_IN", "INSTALLED", "NOT_NEEDED"].includes(
            item.status,
          )),
    );
  };

  const getDeliveredCompletion = (items: AccessoryItemWithUser[]) => {
    const total = items.length;
    if (!total) return 0;
    const delivered = items.filter(
      (item) => item.status === "DELIVERED" || item.status === "INSTALLED",
    ).length;
    return Math.round((delivered / total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className={`max-w-7xl mx-auto transition-opacity ${
        isMobile && isMobileOpen
          ? "opacity-0 pointer-events-none"
          : "opacity-100"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Accessories Tracker</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track accessory purchases for jobs
          </p>
        </div>
        {["admin", "office", "finance"].includes(userRole) && (
          <Link
            href="/accessories/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Tracker
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs, customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as AccessoryItemStatus | "")
            }
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="PENDING_REMEASURE_APPROVAL">
              Pending Remeasure
            </option>
            <option value="READY_TO_ORDER">Ready to Order</option>
            <option value="ORDERED">Ordered</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CHECKED_IN">Checked In</option>
            <option value="INSTALLED">Installed</option>
            <option value="ISSUE">Issue</option>
          </select>

          {/* Department Filter */}
          <select
            value={filterDepartment}
            onChange={(e) =>
              setFilterDepartment(e.target.value as AccessoryDepartment | "")
            }
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Departments</option>
            <option value="CABINETS">Cabinets</option>
            <option value="COUNTERTOPS">Countertops</option>
            <option value="BOTH">Both</option>
          </select>

          {/* Needs Attention Toggle */}
          <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 cursor-pointer">
            <input
              type="checkbox"
              checked={filterNeedsAttention}
              onChange={(e) => setFilterNeedsAttention(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">
              Needs Attention
            </span>
          </label>
        </div>
      </div>

      {/* Trackers List */}
      {trackers.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No accessory trackers found
          </p>
          {["admin", "office", "finance"].includes(userRole) && (
            <Link
              href="/accessories/new"
              className="inline-block mt-4 text-blue-600 hover:text-blue-700"
            >
              Create your first tracker
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Job / Customer
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Milestones
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Completion
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {trackers.map((tracker) => {
                  const counts = getStatusCounts(tracker.items);
                  const hasAttention = needsAttention(tracker.items);
                  const completion = getDeliveredCompletion(tracker.items);

                  return (
                    <tr
                      key={tracker.id}
                      onClick={() => router.push(`/accessories/${tracker.id}`)}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-transform hover:scale-[1.01] active:scale-[1.01]"
                    >
                      <td className="px-6 py-4 text-left">
                        <div className="flex items-start gap-3">
                          {hasAttention && (
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              Job #{tracker.job.jobNumber}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Job Name: {tracker.job.jobName}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-500">
                              {tracker.job.customer.displayName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 text-center">
                        <div className="space-y-1">
                          {tracker.invoiceCreatedAt && (
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              Invoice:{" "}
                              {new Date(
                                tracker.invoiceCreatedAt,
                              ).toLocaleDateString()}
                            </div>
                          )}
                          {tracker.remeasureApprovedAt && (
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              Remeasure:{" "}
                              {new Date(
                                tracker.remeasureApprovedAt,
                              ).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        {tracker.department ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                            {tracker.department}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2 text-xs justify-center">
                          {counts.readyToOrder > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                              {counts.readyToOrder} Ready
                            </span>
                          )}
                          {counts.ordered > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                              {counts.ordered} Ordered
                            </span>
                          )}
                          {counts.delivered > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                              {counts.delivered} Delivered
                            </span>
                          )}
                          {counts.installed > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300">
                              {counts.installed} Done
                            </span>
                          )}
                          {counts.issue > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                              {counts.issue} Issue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <div className="flex justify-center">
                          <div
                            className="relative flex items-center justify-center w-10 h-10 rounded-full"
                            style={{
                              background: `conic-gradient(#22c55e ${completion}%, #e5e7eb ${completion}% 100%)`,
                            }}
                            title={`Delivered ${completion}%`}
                          >
                            <div className="absolute inset-1 bg-white dark:bg-gray-800 rounded-full" />
                            <span className="relative text-[10px] font-semibold text-gray-700 dark:text-gray-200">
                              {completion}%
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <Clock className="w-3 h-3" />
                          {new Date(tracker.updatedAt).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {trackers.map((tracker) => {
              const counts = getStatusCounts(tracker.items);
              const hasAttention = needsAttention(tracker.items);
              const completion = getDeliveredCompletion(tracker.items);

              return (
                <div
                  key={tracker.id}
                  onClick={() => router.push(`/accessories/${tracker.id}`)}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[1.01]"
                >
                  {hasAttention && (
                    <div className="flex items-center gap-2 text-red-500 text-sm font-medium mb-2">
                      <AlertCircle className="w-4 h-4" />
                      Needs Attention
                    </div>
                  )}
                  <div className="mb-3">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      Job #{tracker.job.jobNumber}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Job Name: {tracker.job.jobName}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      {tracker.job.customer.displayName}
                    </div>
                  </div>

                  {tracker.department && (
                    <div className="mb-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                        {tracker.department}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    {counts.readyToOrder > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                        {counts.readyToOrder} Ready
                      </span>
                    )}
                    {counts.ordered > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                        {counts.ordered} Ordered
                      </span>
                    )}
                    {counts.delivered > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        {counts.delivered} Delivered
                      </span>
                    )}
                    {counts.installed > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300">
                        {counts.installed} Done
                      </span>
                    )}
                    {counts.issue > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                        {counts.issue} Issue
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-gray-500 dark:text-gray-400">
                      Delivered
                    </span>
                    <div
                      className="relative flex items-center justify-center w-10 h-10 rounded-full"
                      style={{
                        background: `conic-gradient(#22c55e ${completion}%, #e5e7eb ${completion}% 100%)`,
                      }}
                      title={`Delivered ${completion}%`}
                    >
                      <div className="absolute inset-1 bg-white dark:bg-gray-800 rounded-full" />
                      <span className="relative text-[10px] font-semibold text-gray-700 dark:text-gray-200">
                        {completion}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Updated {new Date(tracker.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
