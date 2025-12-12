"use client";

import { useState } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";

type UserDto = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role:
    | "ADMIN"
    | "SALES"
    | "OFFICE"
    | "FINANCE"
    | "SPECIALIST"
    | "INSTALLER"
    | "UNASSIGNED";
  active: boolean;
};

export default function UsersManagementClient({
  users,
  canManage,
}: {
  users: UserDto[];
  canManage: boolean;
}) {
  const [localUsers, setLocalUsers] = useState(users);

  const handleChange = async (userId: string, update: Partial<UserDto>) => {
    setLocalUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...update } : u))
    );

    try {
      await fetch("/api/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          role: update.role,
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
    switch (role) {
      case "ADMIN":
        return "Admin";
      case "SALES":
        return "Sales";
      case "OFFICE":
        return "Office";
      case "FINANCE":
        return "Finance";
      case "INSTALLER":
        return "Installer";
      case "SPECIALIST":
        return "Specialist";
      case "UNASSIGNED":
      default:
        return "Unassigned";
    }
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
              <div className="flex items-center gap-2 mb-2 sm:mb-0">
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  Role:
                </span>
                {canManage ? (
                  <select
                    value={user.role}
                    onChange={(e) =>
                      handleChange(user.id, {
                        role: e.target.value as UserDto["role"],
                      })
                    }
                    className="border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="SALES">Sales</option>
                    <option value="OFFICE">Office</option>
                    <option value="FINANCE">Finance</option>
                    <option value="INSTALLER">Installer</option>
                    <option value="SPECIALIST">Specialist</option>
                    <option value="UNASSIGNED">Unassigned</option>
                  </select>
                ) : (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-xs">
                    {roleLabel(user.role)}
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
