import Link from "next/link";
import { Lock } from "lucide-react";
import { programs, userCanAccessProgram } from "@/lib/programsConfig";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

export default async function DashboardPage() {
  const { appRole, isActive } = await getCurrentUserWithRole();

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
        {visiblePrograms.map((program) => {
          const hasAccess = userCanAccessProgram(program, appRole, isActive);
          const cardClasses = hasAccess
            ? "bg-white dark:bg-gray-900"
            : "bg-gray-100 dark:bg-gray-800 opacity-80";

          const card = (
            <div
              className={
                "relative rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between " +
                cardClasses
              }
            >
              {/* Lock overlay if user has no access */}
              {!hasAccess && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 dark:bg-gray-900/70 rounded-xl pointer-events-none">
                  <Lock className="w-8 h-8 mb-1 text-gray-700 dark:text-gray-200" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    No access
                  </span>
                </div>
              )}

              <div className={hasAccess ? "opacity-100" : "opacity-40"}>
                <h2 className="text-lg font-medium mb-1 text-gray-800 dark:text-gray-200">
                  {program.name}
                </h2>
                {program.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {program.description}
                  </p>
                )}
              </div>

              <span
                className={
                  "mt-3 text-xs font-medium " +
                  (hasAccess
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-400 dark:text-gray-500")
                }
              >
                Open program →
              </span>
            </div>
          );

          return hasAccess ? (
            <Link key={program.id} href={program.basePath}>
              {card}
            </Link>
          ) : (
            <div key={program.id}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
