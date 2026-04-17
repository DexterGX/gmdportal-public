"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";

type ProgramAccessItem = {
  programId: string;
  name: string;
  description: string;
  basePath: string;
  allowedRoles: string[];
};

type SystemRole = {
  key: string;
  label: string;
  isBuiltIn: boolean;
  isActive: boolean;
};

export default function ProgramAccessSettingsClient() {
  const [items, setItems] = useState<ProgramAccessItem[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [rolesBusy, setRolesBusy] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/settings/program-access", {
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to load program access");
        }

        const payload = await response.json();
        setItems(payload.programs || []);
        setRoles(payload.roles || []);
      } catch (err: any) {
        setError(err?.message || "Failed to load program access settings.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => a.label.localeCompare(b.label)),
    [roles]
  );

  const toggleRole = (programId: string, role: string) => {
    setItems((current) =>
      current.map((item) => {
        if (item.programId !== programId) {
          return item;
        }

        const hasRole = item.allowedRoles.includes(role);
        const nextRoles = hasRole
          ? item.allowedRoles.filter((currentRole) => currentRole !== role)
          : [...item.allowedRoles, role];

        return { ...item, allowedRoles: nextRoles };
      })
    );
  };

  const saveProgram = async (item: ProgramAccessItem) => {
    setSavingFor(item.programId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/settings/program-access", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programId: item.programId,
          allowedRoles: item.allowedRoles,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save program access");
      }

      setNotice(`Saved access for ${item.name}.`);
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.programId === item.programId
            ? {
                ...currentItem,
                allowedRoles: Array.isArray(payload?.allowedRoles)
                  ? payload.allowedRoles
                  : currentItem.allowedRoles,
              }
            : currentItem
        )
      );
    } catch (err: any) {
      setError(err?.message || "Failed to save program access settings.");
    } finally {
      setSavingFor(null);
    }
  };

  const addRole = async () => {
    const value = newRole.trim();
    if (!value) return;

    setRolesBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/settings/program-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: value }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to add role");
      }

      setRoles(payload.roles || []);
      setNewRole("");
      setNotice("Role added.");
    } catch (err: any) {
      setError(err?.message || "Failed to add role.");
    } finally {
      setRolesBusy(false);
    }
  };

  const removeRole = async (roleKey: string) => {
    setRolesBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/settings/program-roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKey }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to remove role");
      }

      setRoles(payload.roles || []);
      setItems((current) =>
        current.map((item) => ({
          ...item,
          allowedRoles: item.allowedRoles.filter((value) => value !== roleKey),
        }))
      );
      setNotice("Role removed.");
    } catch (err: any) {
      setError(err?.message || "Failed to remove role.");
    } finally {
      setRolesBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading program access settings...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Program Access
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Configure which roles can enter each program.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRolesModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          <Users className="h-4 w-4" />
          Users Roles
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          {notice}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {sortedItems.map((item) => {
          const isSaving = savingFor === item.programId;

          return (
            <section
              key={item.programId}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3"
            >
              <div className="mb-2">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {item.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                    {item.description}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500">
                    Path: {item.basePath}
                  </p>
                </div>
              </div>

              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {sortedRoles.map((role) => {
                  const checked = item.allowedRoles.includes(role.key);
                  return (
                    <label
                      key={`${item.programId}-${role.key}`}
                      className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRole(item.programId, role.key)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{role.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] text-gray-500 dark:text-gray-500">
                  {item.allowedRoles.length === 0
                    ? "No roles selected: this program will be hidden from all active users."
                    : `${item.allowedRoles.length} role(s) selected.`}
                </p>

                <button
                  type="button"
                  onClick={() => saveProgram(item)}
                  disabled={isSaving}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {showRolesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Users Roles
              </h2>
              <button
                type="button"
                onClick={() => setShowRolesModal(false)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="mb-4 space-y-2 max-h-64 overflow-auto">
              {sortedRoles.map((role) => (
                <div
                  key={role.key}
                  className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{role.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{role.key}</p>
                  </div>
                  {role.isBuiltIn ? (
                    <span className="text-[11px] font-medium text-gray-500">Built-in</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeRole(role.key)}
                      disabled={rolesBusy}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="Add new role (e.g. estimator assistant)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <button
                type="button"
                onClick={addRole}
                disabled={rolesBusy || !newRole.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
