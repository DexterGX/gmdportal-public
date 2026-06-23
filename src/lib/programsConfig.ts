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
  BarChart3,
  Shirt,
  Users,
  Package,
  FileText,
  ImageIcon,
} from "lucide-react";
import { UserCheck } from "lucide-react";
import type { Role } from "@prisma/client"; // Prisma enum

export const APP_ROLES = [
  "admin",
  "sales",
  "office",
  "finance",
  "specialist",
  "installer",
  "unassigned",
] as const;

// App-facing roles (lowercase, string union)
export type AppRole = (typeof APP_ROLES)[number];

export const ASSIGNABLE_APP_ROLES: AppRole[] = [
  "admin",
  "sales",
  "office",
  "finance",
  "specialist",
  "installer",
];

const APP_ROLE_PRIORITY: AppRole[] = [
  "admin",
  "sales",
  "office",
  "finance",
  "specialist",
  "installer",
  "unassigned",
];

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

export function mapDbRolesToAppRoles(
  dbRoles: Role[] | null | undefined,
): AppRole[] {
  if (!Array.isArray(dbRoles) || dbRoles.length === 0) {
    return [];
  }

  const mapped = dbRoles
    .map((value) => mapDbRoleToAppRole(value))
    .filter((value) => value !== "unassigned");

  return Array.from(new Set(mapped));
}

export function getPrimaryAppRoleFromRoles(roles: AppRole[]): AppRole {
  if (!roles.length) {
    return "unassigned";
  }

  for (const role of APP_ROLE_PRIORITY) {
    if (roles.includes(role)) {
      return role;
    }
  }

  return "unassigned";
}

export type ProgramId =
  | "main"
  | "storeStock"
  | "slabRack"
  | "slabs"
  | "sinks"
  | "settings"
  | "users"
  | "closetJobs"
  | "customers"
  | "accessories"
  | "samplesRequest"
  | "customersV2"
  | "miscEstimates"
  | "paymentTerms"
  | "salesCommission";

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
    id: "sinks",
    name: "Sinks Price List",
    basePath: "/sinksPriceList",
    description: "View and update sink pricing.",
    allowedRoles: ["admin", "sales", "office", "finance"],
    navItems: [
      { icon: GridIcon, name: "Overview", path: "/sinksPriceList" },
      {
        icon: TicketPercent,
        name: "Promotional Sinks",
        path: "/sinksPriceList/promotional",
      },
      {
        icon: ListIcon,
        name: "Availability",
        path: "/sinksPriceList/availability",
      },
      {
        icon: Settings2,
        name: "Brand Settings",
        path: "/sinksPriceList/admin/brands",
        adminOnly: true,
      },
      {
        icon: Table2,
        name: "Sinks Data",
        path: "/sinksPriceList/admin/sinks",
        adminOnly: true,
      },
      {
        icon: PageIcon,
        name: "Import / Export",
        path: "/sinksPriceList/admin/import",
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
      {
        icon: Settings2,
        name: "Program Access",
        path: "/settings/program-access",
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
    id: "miscEstimates",
    name: "Miscellaneous Estimate",
    basePath: "/misc-estimates",
    description:
      "Build and save miscellaneous estimates linked to client jobs.",
    allowedRoles: ["admin", "sales", "office"],
    navItems: [
      {
        icon: FileText,
        name: "New Estimate",
        path: "/misc-estimates",
      },
      {
        icon: FileText,
        name: "Saved Estimates",
        path: "/misc-estimates/saved",
      },
      {
        icon: Settings2,
        name: "Settings",
        path: "/misc-estimates/settings",
        adminOnly: true,
      },
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
  {
    id: "paymentTerms",
    name: "Payment Terms",
    basePath: "/payment-terms",
    description: "Create payment term documents for client agreements.",
    allowedRoles: ["admin", "sales", "office", "finance"],
    navItems: [
      {
        icon: FileText,
        name: "New Payment Term",
        path: "/payment-terms",
      },
      {
        icon: ListIcon,
        name: "Saved Payment Terms",
        path: "/payment-terms/saved",
      },
      {
        icon: ImageIcon,
        name: "Countertop Settings",
        path: "/payment-terms/settings/countertop",
        adminOnly: true,
      },
    ],
    othersItems: [],
  },
  {
    id: "salesCommission",
    name: "Sales Commission",
    basePath: "/sales-commission",
    description:
      "Manage weekly sales commissions, debt ledger, and payout reports.",
    allowedRoles: ["admin", "finance"],
    navItems: [
      {
        icon: TicketPercent,
        name: "Sales Commission",
        path: "/sales-commission",
      },
      {
        icon: ListIcon,
        name: "Commission Periods",
        path: "/sales-commission/periods",
      },
      {
        icon: Table2,
        name: "Closed Invoices",
        path: "/sales-commission/closed",
      },
      {
        icon: BarChart3,
        name: "Rep Status",
        path: "/sales-commission/status",
      },
      {
        icon: Settings2,
        name: "Settings",
        path: "/sales-commission/settings",
      },
    ],
    othersItems: [],
  },
];
export function getProgramForPath(pathname: string): ProgramConfig {
  const normalizedPath = (pathname || "/").toLowerCase();

  const sortedPrograms = [...programs].sort(
    (a, b) => b.basePath.length - a.basePath.length,
  );

  // Find the first program whose basePath matches the pathname
  for (const program of sortedPrograms) {
    if (program.id === "main") continue; // Skip main for now, use as fallback
    const normalizedBasePath = program.basePath.toLowerCase();
    const exactMatch = normalizedPath === normalizedBasePath;
    const nestedMatch = normalizedPath.startsWith(`${normalizedBasePath}/`);

    if (exactMatch || nestedMatch) {
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

export function getDefaultAllowedRolesForProgram(
  programId: ProgramId,
): AppRole[] | undefined {
  const program = programs.find((item) => item.id === programId);
  if (!program?.allowedRoles) {
    return undefined;
  }

  return [...program.allowedRoles];
}
