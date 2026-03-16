import {
  type HistoryEntry,
  type Rack,
  type Slab,
  type SlabBayState,
} from "./mockData";

const buildId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const ORIGINAL_CLIENT_SEPARATOR = "||";

export const encodeClientName = (
  clientName: string,
  originalClientName?: string,
) =>
  originalClientName?.trim()
    ? `${clientName.trim()}${ORIGINAL_CLIENT_SEPARATOR}${originalClientName.trim()}`
    : clientName.trim();

export const splitClientName = (value: string) => {
  const [clientName, originalClientName] = value.split(
    ORIGINAL_CLIENT_SEPARATOR,
  );
  return {
    clientName: (clientName || "").trim(),
    originalClientName: originalClientName?.trim() || undefined,
  };
};

const SLAB_ID_COUNTER_KEY = "slabbay_slab_id_counter";

const getNextSlabId = (state: SlabBayState) => {
  if (typeof window === "undefined") return buildId("slab");
  const existingMax = state.slabs.reduce((max, slab) => {
    const match = slab.id.match(/^slab-(\d+)$/i);
    if (!match) return max;
    const num = Number(match[1]);
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 1000);

  const currentRaw = window.localStorage.getItem(SLAB_ID_COUNTER_KEY);
  const current = currentRaw ? Number(currentRaw) : 1000;
  const nextBase = Math.max(
    existingMax,
    Number.isFinite(current) ? current : 0,
  );
  const next = nextBase + 1;
  window.localStorage.setItem(SLAB_ID_COUNTER_KEY, String(next));
  return `slab-${next}`;
};

const getDefaultState = (): SlabBayState => ({
  racks: [],
  slabs: [],
  history: [],
});

export const loadState = (): SlabBayState => {
  if (typeof window === "undefined") return getDefaultState();
  return getDefaultState();
};

export const saveState = (state: SlabBayState) => {
  if (typeof window === "undefined") return;
  void syncStateToDb(state);
};

export const fetchStateFromDb = async (): Promise<SlabBayState | null> => {
  try {
    const response = await fetch("/api/slab-rack-display/state", {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as SlabBayState;
  } catch {
    return null;
  }
};

export const syncStateToDb = async (state: SlabBayState) => {
  try {
    await fetch("/api/slab-rack-display/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {
    // ignore sync errors; local storage remains source of truth offline
  }
};

export const getRackById = (state: SlabBayState, rackId: string) =>
  state.racks.find((rack) => rack.id === rackId);

export const getSlabsByRack = (state: SlabBayState, rackId: string) =>
  state.slabs.filter((slab) => slab.rackId === rackId);

export const getRackLoad = (state: SlabBayState, rackId: string) =>
  state.slabs.filter((slab) => slab.rackId === rackId).length;

export const addRack = (state: SlabBayState, rack: Rack): SlabBayState => {
  const nextState: SlabBayState = {
    ...state,
    racks: [...state.racks, rack],
  };
  saveState(nextState);
  return nextState;
};

export const addDefaultRacks = (state: SlabBayState): SlabBayState => {
  const buildRange = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => {
      const name = `${prefix}${index + 1}`;
      return {
        id: name.toLowerCase(),
        name,
        capacity: 7,
        note: "",
        countTowardInventory: true,
        targetFill: 5,
      } as Rack;
    });

  const defaults: Rack[] = [
    ...buildRange("A", 30),
    ...buildRange("B", 3),
    {
      id: "c1",
      name: "C1",
      capacity: 7,
      note: "",
      countTowardInventory: true,
      targetFill: 5,
    },
  ];

  const nextState: SlabBayState = {
    ...state,
    racks: defaults,
  };
  saveState(nextState);
  return nextState;
};

export const getRecommendedRack = (
  state: SlabBayState,
  clientName?: string,
): Rack | undefined => {
  const racks = state.racks;
  const slabs = state.slabs;

  const compareRackName = (a: Rack, b: Rack) =>
    a.name.localeCompare(b.name, undefined, { numeric: true });

  if (clientName) {
    const clientRacks = racks
      .map((rack) => ({
        rack,
        count: slabs.filter(
          (slab) =>
            slab.rackId === rack.id &&
            splitClientName(slab.clientName).clientName === clientName,
        ).length,
        total: slabs.filter((slab) => slab.rackId === rack.id).length,
      }))
      .filter((item) => item.count > 0 && item.total < item.rack.capacity)
      .sort((a, b) => b.count - a.count);

    if (clientRacks.length > 0) {
      return clientRacks[0].rack;
    }
  }

  const available = racks
    .map((rack) => ({
      rack,
      total: slabs.filter((slab) => slab.rackId === rack.id).length,
    }))
    .filter((item) => item.total < item.rack.capacity);

  if (available.length === 0) return undefined;

  return available.sort(
    (a, b) => a.total - b.total || compareRackName(a.rack, b.rack),
  )[0].rack;
};

const selectNextRack = (
  state: SlabBayState,
  clientName: string | undefined,
  preferredRackId?: string,
): Rack | undefined => {
  const compareRackName = (a: Rack, b: Rack) =>
    a.name.localeCompare(b.name, undefined, { numeric: true });
  if (preferredRackId) {
    const preferredRack = state.racks.find(
      (rack) => rack.id === preferredRackId,
    );
    if (preferredRack) {
      const load = getRackLoad(state, preferredRack.id);
      if (load < preferredRack.capacity) return preferredRack;
    }
  }

  if (clientName) {
    const clientRacks = state.racks
      .map((rack) => ({
        rack,
        count: state.slabs.filter(
          (slab) =>
            slab.rackId === rack.id &&
            splitClientName(slab.clientName).clientName === clientName,
        ).length,
        total: getRackLoad(state, rack.id),
      }))
      .filter((item) => item.total < item.rack.capacity)
      .sort((a, b) => b.count - a.count || a.total - b.total);

    if (clientRacks.length > 0 && clientRacks[0].count > 0) {
      return clientRacks[0].rack;
    }
  }

  const available = state.racks
    .map((rack) => ({ rack, total: getRackLoad(state, rack.id) }))
    .filter((item) => item.total < item.rack.capacity);

  if (available.length === 0) return undefined;

  const underTarget = available
    .filter((item) => item.total < item.rack.targetFill)
    .sort((a, b) => a.total - b.total || compareRackName(a.rack, b.rack));

  if (underTarget.length > 0) return underTarget[0].rack;

  return available.sort(
    (a, b) => a.total - b.total || compareRackName(a.rack, b.rack),
  )[0].rack;
};

const addSlabLocal = (
  state: SlabBayState,
  input: Omit<Slab, "id" | "createdAt">,
  userName: string,
): SlabBayState => {
  const slab: Slab = {
    ...input,
    id: getNextSlabId(state),
    createdAt: new Date().toISOString(),
  };

  const history: HistoryEntry = {
    id: buildId("log"),
    type: "entry",
    slabId: slab.id,
    slabScannerId: slab.scannerId,
    slabName: slab.name,
    slabType: slab.type,
    clientName: slab.clientName,
    brand: slab.brand,
    toRack: input.rackId.toUpperCase(),
    batchId: slab.batchId,
    batchIndex: slab.batchIndex,
    batchSize: slab.batchSize,
    userName,
    timestamp: new Date().toLocaleString(),
  };

  return {
    ...state,
    slabs: [...state.slabs, slab],
    history: [history, ...state.history],
  };
};

export const addSlab = (
  state: SlabBayState,
  input: Omit<Slab, "id" | "createdAt">,
  userName: string,
): SlabBayState => {
  const nextState = addSlabLocal(state, input, userName);
  saveState(nextState);
  return nextState;
};

export const addMultipleSlabs = (
  state: SlabBayState,
  input: Omit<Slab, "id" | "createdAt" | "rackId">,
  scannerIds: string[] | undefined,
  slabNotes: string[] | undefined,
  quantity: number,
  userName: string,
  preferredRackId?: string,
): SlabBayState => {
  let nextState = { ...state } as SlabBayState;
  const batchId = quantity > 1 ? buildId("batch") : undefined;
  let addedCount = 0;
  const distribution = getRecommendedDistribution(
    state,
    quantity,
    splitClientName(input.clientName).clientName || undefined,
    preferredRackId,
  );

  const plannedRacks = distribution.plan.flatMap((item) =>
    Array.from({ length: item.count }, () => item.rackId),
  );

  for (let i = 0; i < plannedRacks.length; i += 1) {
    const rackId = plannedRacks[i];
    if (!rackId) break;
    const scannerId = scannerIds?.[i] ?? input.scannerId;
    const note = slabNotes?.[i]?.trim();
    nextState = addSlabLocal(
      nextState,
      {
        ...input,
        scannerId,
        notes: slabNotes ? (note || undefined) : input.notes,
        batchId,
        batchIndex: quantity > 1 ? i + 1 : undefined,
        batchSize: quantity > 1 ? quantity : undefined,
        rackId,
      },
      userName,
    );
    addedCount += 1;
  }

  if (batchId && addedCount > 0 && addedCount !== quantity) {
    nextState = {
      ...nextState,
      slabs: nextState.slabs.map((slab) =>
        slab.batchId === batchId ? { ...slab, batchSize: addedCount } : slab,
      ),
      history: nextState.history.map((entry) =>
        entry.batchId === batchId ? { ...entry, batchSize: addedCount } : entry,
      ),
    };
  }

  saveState(nextState);

  return nextState;
};

export const getRecommendedDistribution = (
  state: SlabBayState,
  quantity: number,
  clientName?: string,
  preferredRackId?: string,
) => {
  const plan: Array<{ rackId: string; count: number }> = [];
  let remaining = quantity;
  const loadMap = new Map(
    state.racks.map((rack) => [rack.id, getRackLoad(state, rack.id)]),
  );

  const fillRack = (rack: Rack | undefined) => {
    if (!rack || remaining <= 0) return;
    const load = loadMap.get(rack.id) ?? 0;
    const available = rack.capacity - load;
    if (available <= 0) return;
    const count = Math.min(available, remaining);
    plan.push({ rackId: rack.id, count });
    remaining -= count;
    loadMap.set(rack.id, load + count);
  };

  const racks = state.racks;
  const parseRack = (rack: Rack) => {
    const match = rack.name.match(/^([A-Z]+)(\d+)/i);
    if (!match) return { letterIndex: 0, number: 0 };
    const letter = match[1].toUpperCase();
    const number = Number(match[2]);
    const letterIndex = letter.charCodeAt(0) - 65;
    return { letterIndex, number };
  };

  const preferredRack = racks.find((rack) => rack.id === preferredRackId);
  const preferredMeta = preferredRack ? parseRack(preferredRack) : null;

  const available = racks
    .map((rack) => ({ rack, load: loadMap.get(rack.id) ?? 0 }))
    .filter((item) => item.load < item.rack.capacity);

  let ordered = available
    .map((item) => {
      const meta = parseRack(item.rack);
      const distance = preferredMeta
        ? Math.abs(meta.letterIndex - preferredMeta.letterIndex) * 1000 +
          Math.abs(meta.number - preferredMeta.number)
        : 0;
      return { ...item, distance };
    })
    .sort((a, b) => {
      if (preferredRack) {
        return a.distance - b.distance || a.load - b.load;
      }
      return a.load - b.load;
    })
    .map((item) => item.rack);

  if (preferredRack) {
    ordered = [preferredRack, ...ordered].filter(
      (rack, index, array) =>
        array.findIndex((item) => item.id === rack.id) === index,
    );
  }

  for (const rack of ordered) {
    fillRack(rack);
    if (remaining <= 0) break;
  }

  return { plan, remaining };
};

export const moveSlab = (
  state: SlabBayState,
  slabId: string,
  toRackId: string,
  userName: string,
): SlabBayState => {
  const slab = state.slabs.find((item) => item.id === slabId);
  if (!slab) return state;

  const updatedSlabs = state.slabs.map((item) =>
    item.id === slabId ? { ...item, rackId: toRackId } : item,
  );

  const history: HistoryEntry = {
    id: buildId("log"),
    type: "move",
    slabId: slab.id,
    slabScannerId: slab.scannerId,
    slabName: slab.name,
    slabType: slab.type,
    clientName: slab.clientName,
    brand: slab.brand,
    fromRack: slab.rackId.toUpperCase(),
    toRack: toRackId.toUpperCase(),
    userName,
    timestamp: new Date().toLocaleString(),
  };

  const nextState: SlabBayState = {
    ...state,
    slabs: updatedSlabs,
    history: [history, ...state.history],
  };
  saveState(nextState);
  return nextState;
};

export const exitSlab = (
  state: SlabBayState,
  slabId: string,
  userName: string,
  exitNote?: string,
): SlabBayState => {
  const slab = state.slabs.find((item) => item.id === slabId);
  if (!slab) return state;

  const history: HistoryEntry = {
    id: buildId("log"),
    type: "exit",
    slabId: slab.id,
    slabScannerId: slab.scannerId,
    slabName: slab.name,
    slabType: slab.type,
    clientName: slab.clientName,
    brand: slab.brand,
    fromRack: slab.rackId.toUpperCase(),
    exitNote: exitNote?.trim() ? exitNote.trim() : undefined,
    userName,
    timestamp: new Date().toLocaleString(),
  };

  const nextState: SlabBayState = {
    ...state,
    slabs: state.slabs.filter((item) => item.id !== slabId),
    history: [history, ...state.history],
  };
  saveState(nextState);
  return nextState;
};

export const updateRack = (
  state: SlabBayState,
  rackId: string,
  updates: Partial<Rack>,
): SlabBayState => {
  const nextState: SlabBayState = {
    ...state,
    racks: state.racks.map((rack) =>
      rack.id === rackId ? { ...rack, ...updates } : rack,
    ),
  };
  saveState(nextState);
  return nextState;
};
