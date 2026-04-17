"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";

type UserDto = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  roles: string[];
  active: boolean;
};

type SystemRole = {
  key: string;
  label: string;
  isBuiltIn: boolean;
};

export default function UsersManagementClient({
  users,
  canManage,
}: {
  users: UserDto[];
  canManage: boolean;
}) {
  const [localUsers, setLocalUsers] = useState(users);
  const [roles, setRoles] = useState<SystemRole[]>([]);

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

  const handleChange = async (userId: string, update: Partial<UserDto>) => {
    setLocalUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...update } : u))
    );

    try {
      const rolesPayload = update.roles
        ? update.roles.filter((value) => value !== "unassigned")
        : undefined;

      await fetch("/api/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          role: update.role,
          roles: rolesPayload,
          active: update.active,
        }),
      });
    } catch (e) {
      console.error(e);
      // TODO: show error, maybe revert state
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
        </div>
      ))}
    </div>
  );
}
