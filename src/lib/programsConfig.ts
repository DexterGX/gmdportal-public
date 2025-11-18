import { NavItem } from "./navigationTypes";
import {
  GridIcon,
  ShootingStarIcon,
  CopyIcon,
  ListIcon,
  TableIcon,
  PageIcon,
  PieChartIcon,
  BoxCubeIcon,
  PlugInIcon,
} from "@/icons";

export type ProgramId = "main" | "storeStock" | "slabs" | "users";

export interface ProgramConfig {
  id: ProgramId;
  name: string;
  description?: string;
  basePath: string; // root path that identifies this program
  navItems: NavItem[]; // what should appear under "Menu" for this program
  othersItems: NavItem[]; // what should appear under "Others" for this program
}

export const programs: ProgramConfig[] = [
  {
    id: "main",
    name: "Main Dashboard",
    basePath: "/dashboard",
    description: "General overview and access to all tools.",
    navItems: [
      {
        icon: GridIcon,
        name: "Dashboard",
        path: "/dashboard",
      },
      {
        icon: ShootingStarIcon,
        name: "Users Profiles",
        path: "/profile",
      },
    ],
    othersItems: [],
  },
  {
    id: "storeStock",
    name: "Store Stock",
    basePath: "/store-stock",
    description: "Manage LEDs, propane, tape, transformers and other items.",
    navItems: [
      { icon: GridIcon, name: "Overview", path: "/store-stock" },
      { icon: ListIcon, name: "Movements", path: "/store-stock/movements" },
      { icon: ListIcon, name: "Adjust Stock", path: "/store-stock/adjust" },
      { icon: CopyIcon, name: "Purchase Orders", path: "/store-stock/po" },
    ],
    othersItems: [],
  },
  {
    id: "slabs",
    name: "Slabs Price List",
    basePath: "/slabsPriceList",
    description: "View and update slab pricing.",
    navItems: [
      { icon: GridIcon, name: "Price List", path: "/slabsPriceList" },
      {
        icon: CopyIcon,
        name: "Import / Export",
        path: "/slabsPriceList/import-export",
      },
    ],
    othersItems: [],
  },
  {
    id: "users",
    name: "Users & Profiles",
    basePath: "/profile",
    description: "Manage internal users and permissions.",
    navItems: [
      { icon: ShootingStarIcon, name: "User Profiles", path: "/profile" },
    ],
    othersItems: [],
  },
];

export function getProgramForPath(pathname: string): ProgramConfig {
  // Sort programs by basePath length (descending) to match most specific path first
  const sortedPrograms = [...programs].sort(
    (a, b) => b.basePath.length - a.basePath.length
  );

  // Find the first program whose basePath matches the pathname
  for (const program of sortedPrograms) {
    if (program.id === "main") continue; // Skip main for now, use as fallback
    if (pathname.startsWith(program.basePath)) {
      return program;
    }
  }

  // Default to main program
  return programs.find((p) => p.id === "main") || programs[0];
}
