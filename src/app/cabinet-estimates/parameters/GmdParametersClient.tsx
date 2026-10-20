"use client";

import { useCallback, useEffect, useState } from "react";
import { Calculator, History, ListChecks, Table2 } from "lucide-react";
import CalculationSettings from "./CalculationSettings";
import {
  DiscountsCard,
  InstallationTypesCard,
  ProjectTypesCard,
  RemovalTypesCard,
  SpecialCustomizationCard,
} from "./ListSections";
import type { ParametersBundle, SpecialCustomizationItem } from "./parameterTypes";
import PriceTableSection from "./PriceTableSection";
import VersionsSection from "./VersionsSection";
import { ToastState, ToastView } from "./parametersUi";

interface Props {
  initialParameters: ParametersBundle;
  initialSpecialCustomizationItems: SpecialCustomizationItem[];
}

type TabId = "installation" | "price-table" | "estimate-options" | "versions";

const TABS: { id: TabId; label: string; hint: string; icon: typeof Calculator }[] = [
  { id: "installation", label: "Installation", hint: "Formula, percentages and types", icon: Calculator },
  { id: "price-table", label: "Installers Price Table", hint: "Items, sale prices and installer costs", icon: Table2 },
  { id: "estimate-options", label: "Estimate Options", hint: "Discounts, removal, project types, customizations", icon: ListChecks },
  { id: "versions", label: "Version Updates", hint: "Program and table version history", icon: History },
];

export default function GmdParametersClient({
  initialParameters,
  initialSpecialCustomizationItems,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("installation");
  // A tab is only mounted after it has been opened once, then kept mounted so
  // unsaved edits (e.g. in the price table) survive switching tabs.
  const [visited, setVisited] = useState<Set<TabId>>(new Set<TabId>(["installation"]));
  const [toast, setToast] = useState<ToastState>(null);

  const notify = useCallback((type: "success" | "error", message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  function openTab(id: TabId) {
    setActiveTab(id);
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      // non-fatal - the hash is only a convenience for reload/share
    }
  }

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as TabId;
    if (TABS.some((t) => t.id === hash)) {
      setActiveTab(hash);
      setVisited((prev) => new Set(prev).add(hash));
    }
  }, []);

  const panel = (id: TabId) => (activeTab === id ? "space-y-6" : "hidden");

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <ToastView toast={toast} onClose={closeToast} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">GMD Parameters</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          The numbers and lists behind the Cabinet Estimate program&apos;s auto-calculations. Estimate users
          never edit these - they just pick things and the program prices them.
        </p>
      </div>

      <nav
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 sm:mx-0 sm:px-0 dark:border-gray-700"
        aria-label="Parameter sections"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => openTab(tab.id)}
              title={tab.hint}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {visited.has("installation") && (
        <div className={panel("installation")}>
          <CalculationSettings initial={initialParameters.settings} notify={notify} />
          <InstallationTypesCard initial={initialParameters.installationTypes} notify={notify} />
        </div>
      )}

      {visited.has("price-table") && (
        <div className={panel("price-table")}>
          <PriceTableSection notify={notify} />
        </div>
      )}

      {visited.has("estimate-options") && (
        <div className={panel("estimate-options")}>
          <SpecialCustomizationCard initial={initialSpecialCustomizationItems} notify={notify} />
          <div className="grid gap-6 xl:grid-cols-2">
            <DiscountsCard initial={initialParameters.discountOptions || []} notify={notify} />
            <RemovalTypesCard initial={initialParameters.removalTypes} notify={notify} />
          </div>
          <ProjectTypesCard initial={initialParameters.projectTypes} notify={notify} />
        </div>
      )}

      {visited.has("versions") && (
        <div className={panel("versions")}>
          <VersionsSection notify={notify} />
        </div>
      )}
    </div>
  );
}
