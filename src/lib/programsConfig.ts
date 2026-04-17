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
import {
  TicketPercent,
  Settings2,
  Table2,
  Shirt,
  Users,
  Package,
} from "lucide-react";
import { UserCheck } from "lucide-react";
import type { Role } from "@prisma/client"; // Prisma enum

// App-facing roles (lowercase, string union)
export type AppRole =
  | "admin"
  | "sales"
  | "office"
  | "finance"
  | "specialist"
  | "installer"
  | "unassigned";

// Map Prisma Role enum (ADMIN, SALES, ...) → AppRole string
export function mapDbRoleToAppRole(dbRole: Role | null | undefined): AppRole {
  if (!dbRole) return "unassigned";

  const normalized = String(dbRole).trim().toUpperCase();

  switch (normalized) {
    case "ADMIN":
      return "admin";
    case "SALES":
      return "sales";
    case "OFFICE":
      return "office";
    case "FINANCE":
      return "finance";
    case "SPECIALIST":
      return "specialist";
    case "INSTALLER":
      return "installer";
    case "UNASSIGNED":
    default:
      return "unassigned";
  }
}

export type ProgramId =
  | "main"
  | "storeStock"
  | "slabRack"
  | "slabs"
  | "settings"
  | "users"
  | "closetJobs"
  | "customers"
  | "accessories"
  | "samplesRequest"
  | "customersV2";

export interface ProgramConfig {
  id: ProgramId;
  name: string;
  description?: string;
  basePath: string; // root path that identifies this program
  navItems: NavItem[]; // what should appear under "Menu" for this program
  othersItems: NavItem[]; // what should appear under "Others" for this program
  allowedRoles?: AppRole[]; // if undefined => open to everyone
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
    othersItems: [
      {
        icon: Shirt,
        name: "Closet Jobs",
        path: "/closet-jobs",
      },
      {
        icon: Package,
        name: "Accessories",
        path: "/accessories",
      },
      {
        icon: Package,
        name: "Samples Request",
        path: "/samples-request",
      },
    ],
  },
  {
    id: "storeStock",
    name: "Store Stock",
    basePath: "/store-stock",
    description: "Manage LEDs, propane, tape, transformers and other items.",
    allowedRoles: ["admin", "specialist"],
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
    allowedRoles: ["admin", "sales", "office", "finance"],
    navItems: [
      { icon: GridIcon, name: "Overview", path: "/slabsPriceList" },
      {
        icon: TicketPercent,
        name: "Promotional Slabs",
        path: "/slabsPriceList/promotional",
      },
      {
        icon: ListIcon,
        name: "Availability",
        path: "/slabsPriceList/availability",
      },
      {
        icon: Settings2,
        name: "Brand Settings",
        path: "/slabsPriceList/admin/brands",
        adminOnly: true,
      },
      {
        icon: Table2,
        name: "Slab Data",
        path: "/slabsPriceList/admin/slabs",
        adminOnly: true,
      },
      {
        icon: TicketPercent,
        name: "Manage Promotional",
        path: "/slabsPriceList/admin/promotional",
        adminOnly: true,
      },
      {
        icon: PageIcon,
        name: "Import / Export",
        path: "/slabsPriceList/admin/import",
        adminOnly: true,
      },
    ],
    othersItems: [],
  },
  {
    id: "settings",
    name: "Settings",
    basePath: "/settings",
    description: "Centralized shared settings for all programs.",
    allowedRoles: ["admin"],
    navItems: [
      {
        icon: GridIcon,
        name: "Overview",
        path: "/settings",
      },
      {
        icon: Settings2,
        name: "Company Documents",
        path: "/settings/company-documents",
      },
      {
        icon: ListIcon,
        name: "Cabinets Info",
        path: "/settings/cabinets",
      },
      {
        icon: Table2,
        name: "Cabinet Installation",
        path: "/settings/cabinet-installation",
      },
    ],
    othersItems: [],
  },
  {
    id: "slabRack",
    name: "SlabBay",
    basePath: "/slab-rack-display",
    description: "Visualize slab rack availability.",
    allowedRoles: [
      "admin",
      "sales",
      "office",
      "finance",
      "specialist",
      "installer",
    ],
    navItems: [
      {
        icon: BoxCubeIcon,
        name: "SlabBay",
        path: "/slab-rack-display",
      },
      {
        icon: ListIcon,
        name: "Inventory",
        path: "/slab-rack-display/inventory",
      },
      {
        icon: ListIcon,
        name: "History Log",
        path: "/slab-rack-display/history",
      },
      {
        icon: Package,
        name: "Slab Delivery",
        path: "/slab-rack-display/delivery",
        allowedRoles: ["admin", "office"],
      },
      {
        icon: Settings2,
        name: "Rack Settings",
        path: "/slab-rack-display/settings",
      },
    ],
    othersItems: [],
  },
  {
    id: "users",
    name: "Users & Profiles",
    basePath: "/profile",
    description: "View all users; admins can manage roles and access.",
    allowedRoles: ["admin", "sales", "office", "finance", "specialist"],
    navItems: [
      { icon: ShootingStarIcon, name: "Users Profiles", path: "/profile" },
    ],
    othersItems: [],
  },
  {
    id: "closetJobs",
    name: "Closet Estimate Program",
    basePath: "/closet-jobs",
    description: "Create and manage closet design jobs and quotes.",
    allowedRoles: ["admin", "sales", "installer"],
    navItems: [
      { icon: Shirt, name: "Closet Jobs", path: "/closet-jobs" },
      {
        icon: Settings2,
        name: "Estimate Settings",
        path: "/closet-jobs/admin/settings",
        adminOnly: true,
      },
    ],
    othersItems: [],
  },
  {
    id: "customers",
    name: "Customer Directory",
    basePath: "/customers",
    description: "Manage customer information synced from QuickBooks.",
    allowedRoles: ["admin", "sales"],
    navItems: [
      { icon: Users, name: "All Customers", path: "/customers" },
      {
        icon: PlugInIcon,
        name: "QuickBooks Sync",
        path: "/customers/sync",
        adminOnly: true,
      },
    ],
    othersItems: [],
  },
  {
    id: "customersV2",
    name: "Customers",
    basePath: "/customers-v2",
    description: "Unified client & contractor directory powered by Pipedrive.",
    allowedRoles: ["admin", "sales"],
    navItems: [
      { icon: UserCheck, name: "All Customers", path: "/customers-v2" },
      {
        icon: Users,
        name: "Contractors & Designers",
        path: "/customers-v2?type=CONTRACTOR",
      },
      {
        icon: PlugInIcon,
        name: "Pipedrive Sync",
        path: "/customers-v2/sync",
        adminOnly: true,
      },
    ],
    othersItems: [],
  },
  {
    id: "accessories",
    name: "Accessories Tracker",
    basePath: "/accessories",
    description: "Track accessory purchases for cabinet and countertop jobs.",
    allowedRoles: ["admin", "office", "finance", "sales"],
    navItems: [
      { icon: Package, name: "Accessories", path: "/accessories" },
      { icon: ListIcon, name: "History Log", path: "/accessories/history" },
    ],
    othersItems: [],
  },
  {
    id: "samplesRequest",
    name: "Samples Request",
    basePath: "/samples-request",
    description: "Track cabinet and countertop sample requests.",
    allowedRoles: ["admin", "sales", "office"],
    navItems: [
      { icon: Package, name: "Samples Requested", path: "/samples-request" },
      { icon: ListIcon, name: "History Log", path: "/samples-request/history" },
      {
        icon: Settings2,
        name: "Settings",
        path: "/samples-request/settings",
        adminOnly: true,
      },
    ],
    othersItems: [],
  },
];

export function getProgramForPath(pathname: string): ProgramConfig {
  // Sort programs by basePath length (descending) to match most specific path first
  const sortedPrograms = [...programs].sort(
    (a, b) => b.basePath.length - a.basePath.length,
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

// Helper to check access for a given AppRole
export function userHasAccessToProgram(
  program: ProgramConfig,
  role: AppRole,
): boolean {
  if (!program.allowedRoles || program.allowedRoles.length === 0) return true;
  return program.allowedRoles.includes(role);
}

// Helper to check access considering both role and active status
export function userCanAccessProgram(
  program: ProgramConfig,
  role: AppRole,
  isActive: boolean,
): boolean {
  if (!isActive) return false;
  if (!program.allowedRoles || program.allowedRoles.length === 0) return true;
  return program.allowedRoles.includes(role);
}
