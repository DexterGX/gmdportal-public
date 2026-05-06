"use client";

import { useState } from "react";
import { Save } from "lucide-react";

type AgreementTemplate = {
  id: string;
  key: string;
  title: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
};

export default function AgreementFormsSettingsClient({
  initialTemplates,
}: {
  initialTemplates: AgreementTemplate[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/agreement-forms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templates: templates.map((row) => ({
            key: row.key,
            title: row.title,
            content: row.content,
            isActive: row.isActive,
            sortOrder: row.sortOrder,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save agreement forms");
      }

      const next = Array.isArray(data?.templates)
        ? data.templates.map((row: any) => ({
            id: row.id,
            key: row.key,
            title: row.title,
            content: row.content,
            isActive: row.isActive,
            sortOrder: row.sortOrder,
            updatedAt: new Date(row.updatedAt).toISOString(),
          }))
        : templates;

      setTemplates(next);
      setMessage({ type: "success", text: "Agreement forms saved." });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to save agreement forms.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Agreement Forms
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Edit the agreement templates used by printing and future e-sign
          workflows.
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

      <div className="space-y-4">
        {templates.map((row, idx) => (
          <div
            key={row.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border border-gray-200 dark:border-gray-700"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <input
                  value={row.title}
                  onChange={(e) =>
                    setTemplates((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? { ...item, title: e.target.value }
                          : item,
                      ),
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={row.sortOrder}
                  onChange={(e) =>
                    setTemplates((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? { ...item, sortOrder: Number(e.target.value || 0) }
                          : item,
                      ),
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 self-end pb-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={row.isActive}
                  onChange={(e) =>
                    setTemplates((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? { ...item, isActive: e.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                Active
              </label>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Template Content
              </label>
              <textarea
                rows={8}
                value={row.content}
                onChange={(e) =>
                  setTemplates((prev) =>
                    prev.map((item) =>
                      item.id === row.id
                        ? { ...item, content: e.target.value }
                        : item,
                    ),
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 font-mono text-sm"
                placeholder="Paste or type agreement text here"
              />
            </div>

            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Key: {row.key} · Last updated:{" "}
              {new Date(row.updatedAt).toLocaleString()} · #{idx + 1}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save forms"}
        </button>
      </div>
    </div>
  );
}
