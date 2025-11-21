"use client";

import { usePathname } from "next/navigation";
import SlabsOverview from "./ui/SlabsOverview";
import PromotionalSlabs from "./ui/PromotionalSlabs";
import SlabAvailability from "./ui/SlabAvailability";

export default function SlabsPriceListPage() {
  const pathname = usePathname();

  // Determine active section based on pathname
  const getActiveSection = () => {
    if (pathname === "/slabsPriceList/promotional") return "promotional";
    if (pathname === "/slabsPriceList/availability") return "availability";
    return "overview";
  };

  const activeSection = getActiveSection();

  return (
    <div className="min-h-full">
      {activeSection === "overview" && <SlabsOverview />}
      {activeSection === "promotional" && <PromotionalSlabs />}
      {activeSection === "availability" && <SlabAvailability />}
    </div>
  );
}
