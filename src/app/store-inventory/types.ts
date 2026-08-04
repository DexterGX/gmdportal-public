export type StoreTaxonomy = {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
};

export type StoreItemProviderRow = {
  id: string;
  providerId: string;
  isPreferred: boolean;
  purchaseLink: string | null;
  providerSku: string | null;
  cost: number | null;
  provider: {
    id: string;
    name: string;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    website?: string | null;
  };
};

export type StoreItemStockStatus = "critical" | "low" | "ok";

export type StoreItem = {
  id: string;
  name: string;
  departmentId: string | null;
  groupId: string | null;
  unit: string;
  quantity: number;
  minQuantity: number;
  recommendedQuantity: number;
  purchaseLink: string | null;
  notes: string | null;
  isActive: boolean;
  updatedAt: string;
  department: StoreTaxonomy | null;
  group: StoreTaxonomy | null;
  providers: StoreItemProviderRow[];
  stockStatus: StoreItemStockStatus;
  pendingRequestCount: number;
};

export type StoreUserRef = { id: string; name: string | null; email: string | null } | null;

export type StoreTransaction = {
  id: string;
  itemId: string | null;
  itemName: string | null;
  itemUnit: string | null;
  type: "CHECKOUT" | "RESTOCK_RECEIVED" | "ADJUSTMENT" | "INITIAL";
  change: number;
  oldQuantity: number;
  newQuantity: number;
  reason: string | null;
  jobReference: string | null;
  createdAt: string;
  user: StoreUserRef;
  item?: {
    id: string;
    name: string;
    unit: string;
    department?: { id: string; label: string } | null;
    group?: { id: string; label: string } | null;
  } | null;
};

export type StoreRestockRequest = {
  id: string;
  itemId: string;
  requestedQty: number;
  status: "REQUESTED" | "ORDERED" | "RECEIVED" | "CANCELED";
  notes: string | null;
  actionedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requestedByUser: StoreUserRef;
  actionedByUser: StoreUserRef;
  item?: StoreItem;
};

export const STOCK_STATUS_STYLES: Record<StoreItemStockStatus, { label: string; classes: string }> = {
  critical: {
    label: "Critical",
    classes: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  },
  low: {
    label: "Low",
    classes: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  },
  ok: {
    label: "OK",
    classes: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  },
};

export const RESTOCK_STATUS_STYLES: Record<StoreRestockRequest["status"], { label: string; classes: string }> = {
  REQUESTED: {
    label: "Requested",
    classes: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
  },
  ORDERED: {
    label: "Ordered",
    classes: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  },
  RECEIVED: {
    label: "Received",
    classes: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  },
  CANCELED: {
    label: "Canceled",
    classes: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300",
  },
};

export const TRANSACTION_TYPE_LABELS: Record<StoreTransaction["type"], string> = {
  CHECKOUT: "Checked Out",
  RESTOCK_RECEIVED: "Restock Received",
  ADJUSTMENT: "Adjustment",
  INITIAL: "Initial Stock",
};
