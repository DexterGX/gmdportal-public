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
  version: 1,
  racks: [],
  slabs: [],
  history: [],
});

let latestKnownVersion = 1;
let queuedState: SlabBayState | null = null;
let syncLoopPromise: Promise<void> | null = null;
const normalizeVersion = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const pickRequestVersion = (stateVersion?: number) =>
  Math.max(normalizeVersion(stateVersion), latestKnownVersion);

export const loadState = (): SlabBayState => {
  if (typeof window === "undefined") return getDefaultState();
  return getDefaultState();
};

export const saveState = (state: SlabBayState) => {
  if (typeof window === "undefined") return;
  void enqueueStateSync(state).catch((error) => {
    // Keep async saves non-blocking but visible during debugging.
    console.error("Failed to sync SlabBay state.", error);
  });
};

// Every mutating helper below (addMultipleSlabs, moveSlab, exitSlab, etc.)
// must know whether its write actually reached the database before the UI
// treats the action as successful. `saveState` above is intentionally
// fire-and-forget (used for best-effort background syncs), which is exactly
// what previously let scanned slabs "disappear": the optimistic local state
// update happened unconditionally while a failed/conflicting DB write was
// only logged to the console. `persistState` awaits the write and rejects on
// failure so callers can surface a real error instead of a false "success".
const persistState = async (state: SlabBayState): Promise<SlabBayState> => {
  if (typeof window === "undefined") return state;
  await enqueueStateSync(state);
  return state;
};

export const saveStateToDb = async (state: SlabBayState) => {
  if (typeof window === "undefined") return;
  await enqueueStateSync(state);
};

export const fetchStateFromDb = async (): Promise<SlabBayState | null> => {
  try {
    const response = await fetch("/api/slab-rack-display/state", {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as SlabBayState;
    const version = normalizeVersion(payload.version);
    latestKnownVersion = version;
    return {
      ...payload,
      version,
    };
  } catch {
    return null;
  }
};

export const syncStateToDb = async (state: SlabBayState) => {
  const requestVersion = pickRequestVersion(state.version);
  const response = await fetch("/api/slab-rack-display/state", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-slabbay-version": String(requestVersion),
    },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    if (response.status === 409) {
      const conflictBody = (await response.json().catch(() => null)) as {
        currentVersion?: number;
      } | null;
      if (conflictBody?.currentVersion) {
        latestKnownVersion = normalizeVersion(conflictBody.currentVersion);
      }
      throw new Error(
        "SlabBay data was updated elsewhere. Refresh the page and retry.",
      );
    }

    throw new Error("Failed to sync SlabBay state.");
  }

  const result = (await response.json().catch(() => null)) as {
    version?: number;
  } | null;
  if (result?.version) {
    latestKnownVersion = normalizeVersion(result.version);
  }
};

const runQueuedSync = async () => {
  while (queuedState) {
    const next = queuedState;
    queuedState = null;
    const stateToPersist = {
      ...next,
      version: pickRequestVersion(next.version),
    };
    await syncStateToDb(stateToPersist);
  }
};

const enqueueStateSync = async (state: SlabBayState) => {
  queuedState = {
    ...state,
    version: pickRequestVersion(state.version),
  };

  if (!syncLoopPromise) {
    syncLoopPromise = runQueuedSync().finally(() => {
      syncLoopPromise = null;
    });
  }

  try {
    await syncLoopPromise;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Failed to sync SlabBay state.");
  }
};

export const getRackById = (state: SlabBayState, rackId: string) =>
  state.racks.find((rack) => rack.id === rackId);

export const getSlabsByRack = (state: SlabBayState, rackId: string) =>
  state.slabs.filter((slab) => slab.rackId === rackId);

export const getRackLoad = (state: SlabBayState, rackId: string) =>
  state.slabs.filter((slab) => slab.rackId === rackId).length;

const buildHistorySnapshot = (slab: Slab) => ({
  slabId: slab.id,
  slabScannerId: slab.scannerId,
  slabName: slab.name,
  slabType: slab.type,
  slabThickness: slab.thickness,
  slabSize: slab.size,
  slabNotes: slab.notes?.trim() || undefined,
  slabCreatedAt: slab.createdAt,
  clientName: slab.clientName,
  brand: slab.brand,
  finish: slab.finish,
  jobId: slab.jobId,
  batchId: slab.batchId,
  batchIndex: slab.batchIndex,
  batchSize: slab.batchSize,
});

export const addRack = async (
  state: SlabBayState,
  rack: Rack,
): Promise<SlabBayState> => {
  const nextState: SlabBayState = {
    ...state,
    racks: [...state.racks, rack],
  };
  return persistState(nextState);
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
  createdAt?: string,
): SlabBayState => {
  const slab: Slab = {
    ...input,
    id: getNextSlabId(state),
    createdAt: createdAt ?? new Date().toISOString(),
  };

  const history: HistoryEntry = {
    id: buildId("log"),
    type: "entry",
    ...buildHistorySnapshot(slab),
    entryNote: slab.notes?.trim() || undefined,
    toRack: input.rackId.toUpperCase(),
    userName,
    timestamp: new Date().toLocaleString(),
  };

  return {
    ...state,
    slabs: [...state.slabs, slab],
    history: [history, ...state.history],
  };
};

export const addSlab = async (
  state: SlabBayState,
  input: Omit<Slab, "id" | "createdAt">,
  userName: string,
): Promise<SlabBayState> => {
  const nextState = addSlabLocal(state, input, userName);
  return persistState(nextState);
};

export const addMultipleSlabs = async (
  state: SlabBayState,
  input: Omit<Slab, "id" | "createdAt" | "rackId">,
  scannerIds: string[] | undefined,
  slabNotes: string[] | undefined,
  quantity: number,
  userName: string,
  preferredRackId?: string,
): Promise<SlabBayState> => {
  let nextState = { ...state } as SlabBayState;
  const batchId = quantity > 1 ? buildId("batch") : undefined;
  let addedCount = 0;
  let baseTime = new Date();
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
    const slabTime = new Date(baseTime.getTime() + i);
    nextState = addSlabLocal(
      nextState,
      {
        ...input,
        scannerId,
        notes: slabNotes ? note || undefined : input.notes,
        batchId,
        batchIndex: quantity > 1 ? i + 1 : undefined,
        batchSize: quantity > 1 ? quantity : undefined,
        rackId,
      },
      userName,
      slabTime.toISOString(),
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

  return persistState(nextState);
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

export const moveSlab = async (
  state: SlabBayState,
  slabId: string,
  toRackId: string,
  userName: string,
): Promise<SlabBayState> => {
  const slab = state.slabs.find((item) => item.id === slabId);
  if (!slab) return state;

  const updatedSlabs = state.slabs.map((item) =>
    item.id === slabId ? { ...item, rackId: toRackId } : item,
  );

  const history: HistoryEntry = {
    id: buildId("log"),
    type: "move",
    ...buildHistorySnapshot(slab),
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
  return persistState(nextState);
};

export const exitSlab = async (
  state: SlabBayState,
  slabId: string,
  userName: string,
  exitNote?: string,
): Promise<SlabBayState> => {
  const slab = state.slabs.find((item) => item.id === slabId);
  if (!slab) return state;

  const history: HistoryEntry = {
    id: buildId("log"),
    type: "exit",
    ...buildHistorySnapshot(slab),
    fromRack: slab.rackId.toUpperCase(),
    toRack: "EXIT",
    exitNote: exitNote?.trim() ? exitNote.trim() : undefined,
    userName,
    timestamp: new Date().toLocaleString(),
  };

  const nextState: SlabBayState = {
    ...state,
    slabs: state.slabs.filter((item) => item.id !== slabId),
    history: [history, ...state.history],
  };
  return persistState(nextState);
};

export const updateSlab = async (
  state: SlabBayState,
  slabId: string,
  updates: Partial<Omit<Slab, "id" | "createdAt">>,
  userName: string,
): Promise<SlabBayState> => {
  const slab = state.slabs.find((item) => item.id === slabId);
  if (!slab) return state;

  const updatedSlab = {
    ...slab,
    ...updates,
    brand: updates.brand?.trim() ?? slab.brand,
    finish: updates.finish?.trim() || undefined,
    notes: updates.notes?.trim() || undefined,
    jobId: updates.jobId?.trim() || undefined,
  };

  const history: HistoryEntry = {
    id: buildId("log"),
    type: "change",
    ...buildHistorySnapshot(updatedSlab),
    fromRack: slab.rackId.toUpperCase(),
    toRack: updatedSlab.rackId.toUpperCase(),
    userName,
    timestamp: new Date().toLocaleString(),
  };

  const nextState: SlabBayState = {
    ...state,
    slabs: state.slabs.map((slab) => (slab.id === slabId ? updatedSlab : slab)),
    history: [history, ...state.history],
  };
  return persistState(nextState);
};

export const updateRack = async (
  state: SlabBayState,
  rackId: string,
  updates: Partial<Rack>,
): Promise<SlabBayState> => {
  const nextState: SlabBayState = {
    ...state,
    racks: state.racks.map((rack) =>
      rack.id === rackId ? { ...rack, ...updates } : rack,
    ),
  };
  return persistState(nextState);
};

export const deleteRackWithReassignment = async (
  state: SlabBayState,
  rackId: string,
  destinationRackId: string | null,
  userName: string,
): Promise<{ nextState: SlabBayState; error?: string }> => {
  const sourceRack = state.racks.find((rack) => rack.id === rackId);
  if (!sourceRack) {
    return { nextState: state, error: "Selected rack no longer exists." };
  }

  const slabsInSource = state.slabs.filter((slab) => slab.rackId === rackId);
  if (slabsInSource.length > 0) {
    if (!destinationRackId) {
      return {
        nextState: state,
        error: "Choose a destination rack for existing slabs before deletion.",
      };
    }
    if (destinationRackId === rackId) {
      return {
        nextState: state,
        error:
          "Destination rack must be different from the rack being deleted.",
      };
    }

    const destinationRack = state.racks.find(
      (rack) => rack.id === destinationRackId,
    );
    if (!destinationRack) {
      return {
        nextState: state,
        error: "Destination rack no longer exists.",
      };
    }

    const destinationLoad = getRackLoad(state, destinationRack.id);
    const availableSlots = destinationRack.capacity - destinationLoad;
    if (availableSlots < slabsInSource.length) {
      return {
        nextState: state,
        error: `Destination rack needs ${slabsInSource.length} free slots but only ${Math.max(0, availableSlots)} are available.`,
      };
    }
  }

  const movedSlabIds = new Set(slabsInSource.map((slab) => slab.id));
  const updatedSlabs =
    destinationRackId && slabsInSource.length > 0
      ? state.slabs.map((slab) =>
          movedSlabIds.has(slab.id)
            ? { ...slab, rackId: destinationRackId }
            : slab,
        )
      : state.slabs;

  const moveHistory: HistoryEntry[] =
    destinationRackId && slabsInSource.length > 0
      ? slabsInSource.map((slab) => ({
          id: buildId("log"),
          type: "move",
          ...buildHistorySnapshot(slab),
          fromRack: rackId.toUpperCase(),
          toRack: destinationRackId.toUpperCase(),
          userName,
          timestamp: new Date().toLocaleString(),
        }))
      : [];

  const nextState: SlabBayState = {
    ...state,
    racks: state.racks.filter((rack) => rack.id !== rackId),
    slabs: updatedSlabs,
    history: [...moveHistory, ...state.history],
  };

  try {
    await persistState(nextState);
  } catch (error) {
    return {
      nextState: state,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save rack deletion. Please try again.",
    };
  }
  return { nextState };
};

export const recoverExitedSlab = async (
  state: SlabBayState,
  exitHistoryId: string,
  targetRackId: string,
  userName: string,
): Promise<{ nextState: SlabBayState; error?: string }> => {
  const exitEntry = state.history.find(
    (entry) => entry.id === exitHistoryId && entry.type === "exit",
  );
  if (!exitEntry) {
    return { nextState: state, error: "Exit record not found." };
  }

  if (state.slabs.some((slab) => slab.id === exitEntry.slabId)) {
    return {
      nextState: state,
      error: "This slab is already active in inventory.",
    };
  }

  if (!exitEntry.slabThickness || !exitEntry.slabSize) {
    return {
      nextState: state,
      error:
        "This exit record does not contain enough slab details to restore it.",
    };
  }

  const rack = state.racks.find((item) => item.id === targetRackId);
  if (!rack) {
    return { nextState: state, error: "Selected rack no longer exists." };
  }

  if (getRackLoad(state, rack.id) >= rack.capacity) {
    return { nextState: state, error: "Selected rack is full." };
  }

  const restoredSlab: Slab = {
    id: exitEntry.slabId,
    scannerId: exitEntry.slabScannerId ?? "",
    name: exitEntry.slabName,
    type: exitEntry.slabType,
    thickness: exitEntry.slabThickness,
    size: exitEntry.slabSize,
    clientName: exitEntry.clientName,
    brand: exitEntry.brand || "",
    finish: exitEntry.finish,
    notes: exitEntry.slabNotes?.trim() || undefined,
    jobId: exitEntry.jobId?.trim() || undefined,
    rackId: rack.id,
    createdAt: exitEntry.slabCreatedAt ?? new Date().toISOString(),
    batchId: exitEntry.batchId,
    batchIndex: exitEntry.batchIndex,
    batchSize: exitEntry.batchSize,
  };

  const history: HistoryEntry = {
    id: buildId("log"),
    type: "recovery",
    ...buildHistorySnapshot(restoredSlab),
    fromRack: exitEntry.fromRack,
    toRack: rack.name,
    exitNote: exitEntry.exitNote,
    recoveredFromHistoryId: exitEntry.id,
    userName,
    timestamp: new Date().toLocaleString(),
  };

  const nextState: SlabBayState = {
    ...state,
    slabs: [...state.slabs, restoredSlab],
    history: [history, ...state.history],
  };
  try {
    await persistState(nextState);
  } catch (error) {
    return {
      nextState: state,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save slab recovery. Please try again.",
    };
  }
  return { nextState };
};
