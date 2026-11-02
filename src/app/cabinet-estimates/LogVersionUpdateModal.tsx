"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

type VersionInfo = { actual: string; public: string };

/**
 * "Log a version update" prompt shown after a price list is imported or edited
 * (admins only - the versions API enforces it), so the Version shown on the
 * estimates is never forgotten. Same fields as GMD Parameters > Version Updates.
 */
export default function LogVersionUpdateModal({
  title,
  defaultNote,
  onClose,
}: {
  title: string;
  defaultNote: string;
  onClose: (logged: string | null) => void;
}) {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [kind, setKind] = useState<"major" | "minor" | "tables">("tables");
  const [note, setNote] = useState(defaultNote);
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cabinet-estimates/parameters/versions");
        const json = await res.json();
        if (res.ok && !cancelled) setInfo({ actual: json.actual, public: json.public });
      } catch {
        // non-fatal - the form still works without showing the current version
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cabinet-estimates/parameters/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, note, hidden }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to log update");
      onClose(json.actual as string);
    } catch (err: any) {
      setError(err?.message || "Failed to log update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Log a version update so estimates are stamped with the new version
          {info ? (
            <>
              {" "}
              (currently <strong>{info.actual}</strong>
              {info.public !== info.actual ? <>, public {info.public}</> : null})
            </>
          ) : null}
          .
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">What changed</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "major" | "minor" | "tables")}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="tables">Tables / prices / new items (3rd digit)</option>
              <option value="minor">Program update (2nd digit)</option>
              <option value="major">New program version (1st digit)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            Don&apos;t show publicly (admins only see this change)
          </label>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(null)}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Logging..." : "Log update"}
          </button>
        </div>
      </div>
    </div>
  );
}
