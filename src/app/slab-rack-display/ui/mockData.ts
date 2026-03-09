export type SlabSpotStatus = "empty" | "occupied" | "selected";

export type Rack = {
  id: string;
  name: string;
  capacity: number;
  note?: string;
  countTowardInventory: boolean;
  targetFill: number;
};

export type Slab = {
  id: string;
  scannerId: string;
  name: string;
  type: "SLAB" | "GMD" | "REMNANT" | "RESERVED";
  thickness: string;
  size: string;
  clientName: string;
  rackId: string;
  createdAt: string;
};

export type HistoryEntry = {
  id: string;
  type: "entry" | "exit" | "move";
  slabId: string;
  slabScannerId?: string;
  slabName: string;
  slabType: "SLAB" | "GMD" | "REMNANT" | "RESERVED";
  clientName: string;
  fromRack?: string;
  toRack?: string;
  exitNote?: string;
  userName: string;
  timestamp: string;
};

export type SlabBayState = {
  racks: Rack[];
  slabs: Slab[];
  history: HistoryEntry[];
};

const buildRack = (name: string): Rack => ({
  id: name.toLowerCase(),
  name,
  capacity: 7,
  countTowardInventory: true,
  targetFill: 5,
});

const buildRackRange = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) =>
    buildRack(`${prefix}${index + 1}`),
  );

export const defaultRacks: Rack[] = [];
export const defaultSlabs: Slab[] = [];
export const defaultHistory: HistoryEntry[] = [];
