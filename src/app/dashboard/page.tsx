"use client";
import { programs } from "@/lib/programsConfig";
import Link from "next/link";

export default function DashboardPage() {
  // show all programs EXCEPT the "main" program itself
  const visiblePrograms = programs.filter((p) => p.id !== "main");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
        GM Design Portal
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Choose a program to open.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visiblePrograms.map((program) => (
          <Link
            key={program.id}
            href={program.basePath}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:shadow-md transition shadow-sm flex flex-col justify-between"
          >
            <div>
              <h2 className="text-lg font-medium mb-1 text-gray-800 dark:text-gray-200">
                {program.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {program.description}
              </p>
            </div>
            <span className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-medium">
              Open program →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
