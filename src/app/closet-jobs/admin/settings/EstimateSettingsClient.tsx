"use client";

import { useState } from "react";
import Link from "next/link";

interface Installer {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  active: boolean;
}

interface Settings {
  defaultGmFactor: string;
  quoteNumberFormat: string;
}

export default function EstimateSettingsClient({
  installers,
  settings: initialSettings,
}: {
  installers: Installer[];
  settings: Settings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/closet-jobs/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Settings saved successfully" });
      } else {
        const error = await response.json();
        setMessage({
          type: "error",
          text: error.error || "Failed to save settings",
        });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/closet-jobs"
          className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          ← Back to Closet Jobs
        </Link>
        <h1 className="text-3xl font-bold">Estimate Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage installers and settings for the Closet Estimate Program
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Available Installers Section */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold mb-2">Available Installers</h2>
          <p className="text-sm text-gray-600">
            Users with the INSTALLER role can be assigned to closet jobs. To add
            or remove installers, update user roles in the Users & Profiles
            section.
          </p>
        </div>

        <div className="p-6">
          {installers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">No installers available.</p>
              <p className="text-sm">
                Assign the INSTALLER role to users in the Users & Profiles
                section to make them available for closet jobs.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {installers.map((installer) => (
                <div
                  key={installer.id}
                  className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                      installer.active ? "bg-green-500" : "bg-gray-400"
                    }`}
                  >
                    {(
                      installer.name?.[0] ||
                      installer.email?.[0] ||
                      "?"
                    ).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {installer.name || "No name"}
                    </p>
                    <p className="text-sm text-gray-600 truncate">
                      {installer.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* General Settings Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">General Settings</h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Default GM Factor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default GM Factor
            </label>
            <input
              type="number"
              step="0.01"
              min="1"
              max="10"
              value={settings.defaultGmFactor}
              onChange={(e) =>
                setSettings({ ...settings, defaultGmFactor: e.target.value })
              }
              className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              The default multiplier applied to installer costs to calculate
              client prices. Example: 1.35 means add 35% markup.
            </p>
          </div>

          {/* Quote Number Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quote Number Format
            </label>
            <input
              type="text"
              value={settings.quoteNumberFormat}
              onChange={(e) =>
                setSettings({ ...settings, quoteNumberFormat: e.target.value })
              }
              className="w-full max-w-2xl px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
            <div className="mt-2 text-xs text-gray-600 space-y-1">
              <p className="font-medium">Available tokens:</p>
              <ul className="list-disc list-inside pl-2 space-y-1">
                <li>
                  <code className="bg-gray-100 px-1 py-0.5 rounded">
                    {"{INITIALS}"}
                  </code>{" "}
                  - First and last name initials of sales person (e.g., DG for
                  Diego Gama)
                </li>
                <li>
                  <code className="bg-gray-100 px-1 py-0.5 rounded">
                    {"{YYMMDD}"}
                  </code>{" "}
                  - Year, month, day (e.g., 250315 for March 15, 2025)
                </li>
                <li>
                  <code className="bg-gray-100 px-1 py-0.5 rounded">
                    {"{SEQ3}"}
                  </code>{" "}
                  - 3-digit sequence number for the day (001, 002, 003...)
                </li>
              </ul>
              <p className="mt-2 pt-2 border-t border-gray-200">
                <span className="font-medium">Example:</span>{" "}
                <code className="bg-gray-100 px-1 py-0.5 rounded">
                  {"{INITIALS}-CQUO-{YYMMDD}-{SEQ3}"}
                </code>
                <br />
                <span className="text-gray-500">
                  Result: DG-CQUO-250315-001 (Diego Gama, March 15, 2025, first
                  quote)
                </span>
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
