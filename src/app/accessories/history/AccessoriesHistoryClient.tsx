"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ClipboardList,
  ArrowRightLeft,
  MessageSquare,
  Edit3,
  PlusCircle,
  User,
} from "lucide-react";
import { useSidebar } from "@/context/SidebarContext";
import {
  getAccessoryHistory,
  type AccessoryHistoryEntry,
} from "@/lib/accessories";
import type { AccessoryEventType } from "@prisma/client";

export default function AccessoriesHistoryClient() {
  const { isMobileOpen, isMobile } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AccessoryHistoryEntry[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [eventType, setEventType] = useState<AccessoryEventType | "ALL">("ALL");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const jobNumber = Number(jobSearch);
        const data = await getAccessoryHistory({
          search: jobSearch.trim() || undefined,
          jobNumber: Number.isFinite(jobNumber) ? jobNumber : undefined,
          itemName: itemSearch.trim() || undefined,
          eventType,
        });
        if (active) setEvents(data);
      } catch (error) {
        console.error("Error loading history:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(load, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobSearch, itemSearch, userSearch, eventType]);

  const filteredEvents = useMemo(() => {
    if (!userSearch.trim()) return events;
    return events.filter((event) =>
      (event.changedByUser?.name || "")
        .toLowerCase()
        .includes(userSearch.trim().toLowerCase()),
    );
  }, [events, userSearch]);

  const getEventIcon = (type: AccessoryEventType) => {
    switch (type) {
      case "STATUS_CHANGE":
        return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
      case "NOTE":
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case "FIELD_EDIT":
        return <Edit3 className="w-4 h-4 text-yellow-500" />;
      case "CREATED":
      default:
        return <PlusCircle className="w-4 h-4 text-green-500" />;
    }
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
          <h1 className="text-3xl font-bold">Accessories History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            All changes made to accessory trackers and items
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              placeholder="Search by Job #"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search items"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={eventType}
            onChange={(e) =>
              setEventType(e.target.value as AccessoryEventType | "ALL")
            }
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Event Types</option>
            <option value="CREATED">Created</option>
            <option value="STATUS_CHANGE">Status Change</option>
            <option value="FIELD_EDIT">Field Edit</option>
            <option value="NOTE">Note</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-10 text-center text-gray-500">
          Loading history...
        </div>
      ) : emptyState ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-10 text-center text-gray-500">
          <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          No history events found.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="hidden lg:block">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Job
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredEvents.map((event) => (
                  <tr
                    key={event.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  >
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      <div>
                        {new Date(event.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(event.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        Job #{event.item.tracker.job.jobNumber} —{" "}
                        {event.item.tracker.job.jobName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {event.item.tracker.job.customer.displayName}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {event.item.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {event.item.tracker.invoiceNumber || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        {getEventIcon(event.type)}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {event.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      {event.message && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {event.message}
                        </div>
                      )}
                      {event.fromStatus && event.toStatus && (
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {event.fromStatus.replace(/_/g, " ")} →{" "}
                          {event.toStatus.replace(/_/g, " ")}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {event.changedByUser?.name || "System"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEvents.map((event) => (
              <div key={event.id} className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {getEventIcon(event.type)}
                  {new Date(event.createdAt).toLocaleString()}
                </div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  Job #{event.item.tracker.job.jobNumber} —{" "}
                  {event.item.tracker.job.jobName}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {event.item.tracker.job.customer.displayName}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  Item: {event.item.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Invoice #: {event.item.tracker.invoiceNumber || "—"}
                </div>
                <div className="mt-2 text-sm">
                  <span className="font-medium">
                    {event.type.replace(/_/g, " ")}
                  </span>
                  {event.message && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {event.message}
                    </div>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {event.changedByUser?.name || "System"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
