"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

type QuoteRepairSettings = {
  id: string;
  authorizationText: string;
  hoaPermitNote: string;
  defaultCustomerTerms: string | null;
  footerText: string | null;
};

type QuoteRepairService = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

export default function QuoteRepairSettingsClient({
  initialSettings,
  initialServices,
}: {
  initialSettings: QuoteRepairSettings;
  initialServices: QuoteRepairService[];
}) {
  const [authorizationText, setAuthorizationText] = useState(initialSettings.authorizationText || "");
  const [hoaPermitNote, setHoaPermitNote] = useState(initialSettings.hoaPermitNote || "");
  const [defaultCustomerTerms, setDefaultCustomerTerms] = useState(initialSettings.defaultCustomerTerms || "");
  const [footerText, setFooterText] = useState(initialSettings.footerText || "");
  const [services, setServices] = useState<QuoteRepairService[]>(initialServices);
  const [newServiceName, setNewServiceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingService, setSavingService] = useState(false);

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [services],
  );

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/quote-repairs/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          authorizationText,
          hoaPermitNote,
          defaultCustomerTerms,
          footerText,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }
      setServices(Array.isArray(data.services) ? data.services : []);
      window.alert("Quote Repair settings saved.");
    } catch (error: any) {
      window.alert(error?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addService = async () => {
    if (!newServiceName.trim()) {
      return;
    }

    setSavingService(true);
    try {
      const response = await fetch("/api/quote-repairs/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_service",
          name: newServiceName,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add service");
      }

      setServices(Array.isArray(data.services) ? data.services : []);
      setNewServiceName("");
    } catch (error: any) {
      window.alert(error?.message || "Failed to add service");
    } finally {
      setSavingService(false);
    }
  };

  const removeService = async (serviceId: string) => {
    setSavingService(true);
    try {
      const response = await fetch("/api/quote-repairs/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_service",
          serviceId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove service");
      }

      setServices(Array.isArray(data.services) ? data.services : []);
    } catch (error: any) {
      window.alert(error?.message || "Failed to remove service");
    } finally {
      setSavingService(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Quote Repair Settings</h1>

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Print Text Settings</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Authorization Text</label>
          <textarea
            value={authorizationText}
            onChange={(e) => setAuthorizationText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">HOA / Permit Note</label>
          <textarea
            value={hoaPermitNote}
            onChange={(e) => setHoaPermitNote(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Default Customer Terms</label>
          <textarea
            value={defaultCustomerTerms}
            onChange={(e) => setDefaultCustomerTerms(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Footer Text</label>
          <textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
            rows={2}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Services Catalog</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          These services appear in the Service dropdown when creating or editing quote repair versions.
        </p>

        <div className="flex gap-2">
          <input
            value={newServiceName}
            onChange={(e) => setNewServiceName(e.target.value)}
            placeholder="New service name"
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          />
          <button
            type="button"
            onClick={addService}
            disabled={savingService}
            className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
          >
            Add Service
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Service</th>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedServices.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-gray-500">No services configured.</td>
                </tr>
              ) : (
                sortedServices.map((service) => (
                  <tr key={service.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2">{service.name}</td>
                    <td className="px-3 py-2">{service.sortOrder}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeService(service.id)}
                        disabled={savingService}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
