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
import { TicketPercent, Settings2, Table2 } from "lucide-react";
import type { Role } from "@prisma/client"; // Prisma enum

// App-facing roles (lowercase, string union)
export type AppRole =
  | "admin"
  | "sales"
  | "office"
  | "finance"
  | "specialist"
  | "unassigned";

// Map Prisma Role enum (ADMIN, SALES, ...) → AppRole string
export function mapDbRoleToAppRole(dbRole: Role | null | undefined): AppRole {
  switch (dbRole) {
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
    case "UNASSIGNED":
    default:
      return "unassigned";
  }
}

export type ProgramId = "main" | "storeStock" | "slabs" | "users";

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
    othersItems: [],
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
        icon: PageIcon,
        name: "Import / Export",
        path: "/slabsPriceList/admin/import",
        adminOnly: true,
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

// Helper to check access for a given AppRole
export function userHasAccessToProgram(
  program: ProgramConfig,
  role: AppRole
): boolean {
  if (!program.allowedRoles || program.allowedRoles.length === 0) return true;
  return program.allowedRoles.includes(role);
}

// Helper to check access considering both role and active status
export function userCanAccessProgram(
  program: ProgramConfig,
  role: AppRole,
  isActive: boolean
): boolean {
  if (!isActive) return false;
  if (!program.allowedRoles || program.allowedRoles.length === 0) return true;
  return program.allowedRoles.includes(role);
}
