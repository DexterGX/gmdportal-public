import Link from "next/link";
import { Building2, Hammer, UsersRound } from "lucide-react";

const cards = [
  {
    title: "Company Documents",
    description:
      "Manage shared company name, phone, address and logo used by document templates.",
    href: "/settings/company-documents",
    icon: Building2,
  },
  {
    title: "Cabinets Info",
    description:
      "Manage cabinet provider actual/display names and contact details for reuse across programs.",
    href: "/settings/cabinets",
    icon: UsersRound,
  },
  {
    title: "Cabinet Installation",
    description:
      "Manage installer profiles, installation items, and target pay values for future estimate automation.",
    href: "/settings/cabinet-installation",
    icon: Hammer,
  },
];

export default function SettingsOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Centralized settings used across all programs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {card.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {card.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
