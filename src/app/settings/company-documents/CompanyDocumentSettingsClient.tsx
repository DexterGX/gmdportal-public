"use client";

import { useState } from "react";
import { Save, Upload } from "lucide-react";

type CompanyDocumentSettings = {
  id: string;
  companyName: string;
  phoneNumber: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  logoUrl: string;
  showPrintGuides: boolean;
  updatedAt: string;
};

export default function CompanyDocumentSettingsClient({
  initialSettings,
}: {
  initialSettings: CompanyDocumentSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: settings.companyName,
          phoneNumber: settings.phoneNumber,
          email: settings.email,
          website: settings.website,
          address: settings.address,
          logoUrl: settings.logoUrl,
          showPrintGuides: settings.showPrintGuides,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save settings");
      }

      setSettings((prev) => ({
        ...prev,
        updatedAt: data.updatedAt || prev.updatedAt,
      }));
      setMessage({ type: "success", text: "Company document settings saved." });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to save company settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/settings/company/logo-upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to upload logo");
      }

      setSettings((prev) => ({ ...prev, logoUrl: data.logoUrl }));
      setMessage({ type: "success", text: "Company logo updated." });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to upload logo.",
      });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Company Documents Settings
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure shared company information used in document headers and
          templates.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Company Logo
            </div>
            <div className="w-48 h-32 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-3">
              <img
                src={settings.logoUrl || "/logo.svg"}
                alt="Company logo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
              <Upload className="w-4 h-4" />
              {isUploading ? "Uploading..." : "Upload logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={isUploading}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Name
              </label>
              <input
                value={settings.companyName}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    companyName: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                placeholder="GM Design"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                value={settings.phoneNumber || ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value || null,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                placeholder="(305) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                value={settings.email || ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    email: e.target.value || null,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                placeholder="info@gmdesign.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Website
              </label>
              <input
                value={settings.website || ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    website: e.target.value || null,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                placeholder="www.gmdesign.com"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address
              </label>
              <textarea
                value={settings.address || ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    address: e.target.value || null,
                  }))
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                placeholder="123 Main St, Miami, FL"
              />
            </div>

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={settings.showPrintGuides}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      showPrintGuides: e.target.checked,
                    }))
                  }
                />
                Show dotted print guide lines in documents
              </label>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                When disabled, agreement and printable document guide outlines
                are hidden.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {new Date(settings.updatedAt).toLocaleString()}
          </p>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
