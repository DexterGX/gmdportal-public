"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Notify, SectionCard, fieldClass, primaryButton } from "./parametersUi";

type VersionLogEntry = {
  id: string;
  version: string;
  kind: string;
  note: string;
  hidden: boolean;
  createdByName: string;
  createdAt: string;
};

type VersionInfo = { actual: string; public: string; log: VersionLogEntry[] };

const KIND_LABELS: Record<string, string> = {
  major: "New program version",
  minor: "Program update",
  tables: "Tables / prices",
};

export default function VersionsSection({ notify }: { notify: Notify }) {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"major" | "minor" | "tables">("tables");
  const [note, setNote] = useState("");
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cabinet-estimates/parameters/versions");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load versions");
        if (!cancelled) setInfo(json);
      } catch (err: any) {
        if (!cancelled) notify("error", err?.message || "Failed to load versions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // notify is stable from the parent shell; loading once on mount is intended
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logUpdate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/cabinet-estimates/parameters/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, note, hidden }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to log update");
      setInfo(json);
      setNote("");
      setHidden(false);
      notify("success", `Version updated to ${json.actual}.`);
    } catch (err: any) {
      notify("error", err?.message || "Failed to log update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Version Updates"
      description={
        <>
          Format <strong>A.B.C</strong>: A = program version, B = update to the program, C = update to the
          tables (prices / new items). A bigger bump resets the digits to its right to 0. New and re-saved
          estimates are stamped with the current version automatically. Tick &quot;Don&apos;t show
          publicly&quot; to log an update only admins see - everyone else keeps seeing the previous public
          version until the next public update.
        </>
      }
    >
      {loading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
          <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
        </div>
      ) : info ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Actual version (admins)
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{info.actual}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Public version (everyone else)
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{info.public}</div>
            </div>
          </div>

          <form
            onSubmit={logUpdate}
            className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end dark:border-gray-700 dark:bg-gray-900/40"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                What changed
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "major" | "minor" | "tables")}
                className={fieldClass}
              >
                <option value="tables">Tables / prices / new items (3rd digit)</option>
                <option value="minor">Program update (2nd digit)</option>
                <option value="major">New program version (1st digit)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Note (optional)
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Updated Jarlin price list"
                className={fieldClass}
              />
            </div>
            <button type="submit" disabled={saving} className={primaryButton}>
              <Save className="h-4 w-4" />
              {saving ? "Logging..." : "Log update"}
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-3 dark:text-gray-300">
              <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
              Don&apos;t show publicly (admins only see this change)
            </label>
          </form>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Version</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Note</th>
                  <th className="px-3 py-2 text-left font-medium">Visibility</th>
                  <th className="px-3 py-2 text-left font-medium">By</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {info.log.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                      No updates logged yet.
                    </td>
                  </tr>
                )}
                {info.log.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2 font-semibold">{entry.version}</td>
                    <td className="px-3 py-2">{KIND_LABELS[entry.kind] ?? entry.kind}</td>
                    <td className="px-3 py-2">{entry.note || "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          entry.hidden
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        }`}
                      >
                        {entry.hidden ? "Admins only" : "Public"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{entry.createdByName || "-"}</td>
                    <td className="px-3 py-2">{new Date(entry.createdAt).toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Version information is not available right now.</p>
      )}
    </SectionCard>
  );
}
