"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck, Trash2 } from "lucide-react";

type UserDto = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  roles: string[];
  programAdminFor: string[];
  active: boolean;
};

type ProgramAdminOption = {
  id: string;
  name: string;
  /** Roles allowed into the program (Settings → Program Access); null = everyone. */
  allowedRoles: string[] | null;
};

type SystemRole = {
  key: string;
  label: string;
  isBuiltIn: boolean;
};

export default function UsersManagementClient({
  users,
  canManage,
  programAdminOptions,
}: {
  users: UserDto[];
  canManage: boolean;
  programAdminOptions: ProgramAdminOption[];
}) {
  const [localUsers, setLocalUsers] = useState(users);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), 3500);
    },
    []
  );

  useEffect(() => {
    if (!canManage) return;

    fetch("/api/settings/program-roles", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (Array.isArray(payload?.roles)) {
          setRoles(payload.roles);
        }
      })
      .catch(() => {
        setRoles([]);
      });
  }, [canManage]);

  const handleChange = async (
    userId: string,
    update: Partial<UserDto>,
    successMessage = "User updated."
  ) => {
    const previous = localUsers.find((u) => u.id === userId);

    setLocalUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...update } : u))
    );

    try {
      const rolesPayload = update.roles
        ? update.roles.filter((value) => value !== "unassigned")
        : undefined;

      const response = await fetch("/api/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          role: update.role,
          roles: rolesPayload,
          active: update.active,
          programAdminFor: update.programAdminFor,
        }),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || "Failed to update user");
      }

      showToast("success", successMessage);
    } catch (e) {
      console.error(e);
      if (previous) {
        setLocalUsers((prev) =>
          prev.map((u) => (u.id === userId ? previous : u))
        );
      }
      showToast(
        "error",
        e instanceof Error ? e.message : "Failed to update user"
      );
    }
  };

  const handleDelete = async (userId: string, userName: string | null) => {
    if (
      !confirm(
        `Are you sure you want to delete user "${
          userName || "Unknown"
        }"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/users/manage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setLocalUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        const error = await response.text();
        alert(`Failed to delete user: ${error}`);
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while deleting the user.");
    }
  };

  const roleLabel = (role: UserDto["role"]) => {
    if (!role) return "Unassigned";
    return role
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const getEffectiveRoles = (user: UserDto): string[] => {
    const fromArray = (user.roles || []).filter(
      (value): value is string => typeof value === "string" && Boolean(value)
    );

    if (fromArray.length > 0) {
      return Array.from(new Set(fromArray));
    }

    if (user.role && user.role !== "unassigned") {
      return [user.role];
    }

    return [];
  };

  const canRolesAccess = (option: ProgramAdminOption, userRoles: string[]) =>
    option.allowedRoles === null ||
    userRoles.some((role) => option.allowedRoles?.includes(role));

  const toggleProgramAdmin = (user: UserDto, option: ProgramAdminOption) => {
    const current = user.programAdminFor || [];
    const enabling = !current.includes(option.id);
    const next = enabling
      ? [...current, option.id]
      : current.filter((value) => value !== option.id);

    handleChange(
      user.id,
      { programAdminFor: next },
      `${user.name ?? "User"} is ${enabling ? "now" : "no longer"} a Program Admin for ${option.name}.`
    );
  };

  const renderProgramAdminSection = (user: UserDto) => {
    const userRoles = getEffectiveRoles(user);

    if (userRoles.includes("admin")) {
      return (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Admin role &mdash; full access to every program.
        </p>
      );
    }

    const granted = user.programAdminFor || [];
    const accessible = programAdminOptions.filter((option) =>
      canRolesAccess(option, userRoles)
    );
    // Grants kept on programs the user can no longer open (role/access changed)
    const dormant = programAdminOptions.filter(
      (option) =>
        granted.includes(option.id) && !canRolesAccess(option, userRoles)
    );

    if (!canManage) {
      const active = accessible.filter((option) =>
        granted.includes(option.id)
      );
      return active.length ? (
        <div className="flex flex-wrap gap-1.5">
          {active.map((option) => (
            <span
              key={`${user.id}-pa-${option.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
            >
              <ShieldCheck className="h-3 w-3" />
              {option.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">None</p>
      );
    }

    if (accessible.length === 0 && dormant.length === 0) {
      return (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This user&apos;s roles don&apos;t give access to any program yet.
        </p>
      );
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        {[...accessible, ...dormant].map((option) => {
          const isOn = granted.includes(option.id);
          const isDormant = dormant.includes(option);
          return (
            <button
              key={`${user.id}-pa-${option.id}`}
              type="button"
              onClick={() => toggleProgramAdmin(user, option)}
              aria-pressed={isOn}
              title={
                isDormant
                  ? "User can't open this program with their current roles. Click to remove."
                  : isOn
                    ? "Program Admin — click to remove"
                    : "Click to make Program Admin"
              }
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                isDormant
                  ? "border-dashed border-gray-300 text-gray-400 line-through dark:border-gray-600 dark:text-gray-500"
                  : isOn
                    ? "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700"
                    : "border-gray-300 bg-white text-gray-700 hover:border-indigo-400 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-indigo-500"
              }`}
            >
              {isOn && !isDormant && <ShieldCheck className="h-3 w-3" />}
              {option.name}
            </button>
          );
        })}
      </div>
    );
  };

  const toggleRole = (user: UserDto, role: string) => {
    const current = getEffectiveRoles(user);
    const next = current.includes(role)
      ? current.filter((value) => value !== role)
      : [...current, role];

    handleChange(user.id, {
      roles: next,
      role: next[0] || "unassigned",
    });
  };

  return (
    <div className="space-y-3 max-w-5xl mx-auto">
      {toast && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-[60] rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      {canManage && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Program Admin
          </span>{" "}
          gives a user the highest access level inside a program (admin-only
          pages like Settings, Price Lists and Imports, plus every action),
          without making them a full Admin. Only programs their roles can open
          are listed; manage which roles open each program in Settings &rarr;
          Program Access.
        </p>
      )}

      {localUsers.map((user) => (
        <div
          key={user.id}
          className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* LEFT: avatar + name/email */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              {user.image ? (
                <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                  <Image
                    src={user.image}
                    alt={user.name ?? user.email ?? "User"}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-medium truncate text-gray-800 dark:text-gray-200">
                  {user.name ?? "Unnamed user"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </div>
              </div>
            </div>

            {/* RIGHT: role + status controls + delete */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6 text-sm">
              {/* Role block */}
              <div className="flex flex-col gap-2 mb-2 sm:mb-0 min-w-[220px]">
                <span className="text-gray-500 dark:text-gray-400 text-xs">Roles:</span>
                {canManage ? (
                  <div className="grid grid-cols-2 gap-1">
                    {roles.map((role) => (
                      <label
                        key={`${user.id}-${role.key}`}
                        className="inline-flex items-center gap-1 text-xs cursor-pointer text-gray-800 dark:text-gray-200"
                      >
                        <input
                          type="checkbox"
                          checked={getEffectiveRoles(user).includes(role.key)}
                          onChange={() => toggleRole(user, role.key)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{role.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-xs">
                    {getEffectiveRoles(user).length
                      ? getEffectiveRoles(user).map((role) => roleLabel(role)).join(", ")
                      : "Unassigned"}
                  </span>
                )}
              </div>

              {/* Status block */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  Status:
                </span>
                {canManage ? (
                  <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={user.active}
                      onChange={(e) =>
                        handleChange(user.id, { active: e.target.checked })
                      }
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-800 dark:text-gray-200">
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </label>
                ) : (
                  <span className="font-medium text-xs text-gray-800 dark:text-gray-200">
                    {user.active ? "Active" : "Inactive"}
                  </span>
                )}
              </div>

              {/* Delete button */}
              {canManage && (
                <button
                  onClick={() => handleDelete(user.id, user.name)}
                  className="flex items-center justify-center p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  title="Delete user"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Program Admin (highest access level per program) */}
          <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Program Admin:</span>
            </div>
            {renderProgramAdminSection(user)}
          </div>
        </div>
      ))}
    </div>
  );
}
