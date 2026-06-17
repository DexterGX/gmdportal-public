"use client";

import { useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { CMSSettings, DEFAULT_SETTINGS } from "../types";

export default function SalesCommissionSettingsClient({
  settings,
}: {
  settings: CMSSettings | null;
}) {
  const [form, setForm] = useState<CMSSettings>(settings ?? DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");

  const save = async () => {
    const res = await fetch("/api/sales-commission/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) setMessage("Settings saved.");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-gray-500">
          Sales Commission Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-gray-900">
          Highlight colors and payment split
        </h1>
        <div className="mt-4 flex gap-2">
          <Link
            href="/sales-commission"
            className="rounded-full border px-4 py-2 text-sm"
          >
            Back
          </Link>
          <button
            onClick={save}
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-white"
          >
            <Save className="h-4 w-4" /> Save
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["firstPaymentPercent", "First payment %"],
          ["secondPaymentPercent", "Second payment %"],
          ["colorPending", "Pending color"],
          ["colorFirstPayment", "First payment color"],
          ["colorFirstPaid", "First paid color"],
          ["colorClosing", "Closing color"],
          ["colorHold", "Hold color"],
          ["colorHoldSignature", "Missing signature color"],
          ["colorError", "Invalid/error color"],
        ].map(([key, label]) => (
          <label
            key={key}
            className="rounded-3xl border bg-white p-4 shadow-sm"
          >
            <div className="text-sm font-medium text-gray-700">{label}</div>
            <input
              className="mt-2 w-full rounded-2xl border px-4 py-3"
              value={(form as any)[key]}
              onChange={(e) =>
                setForm(
                  (prev) =>
                    ({
                      ...prev,
                      [key]: key.includes("Percent")
                        ? Number(e.target.value)
                        : e.target.value,
                    }) as CMSSettings,
                )
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}
