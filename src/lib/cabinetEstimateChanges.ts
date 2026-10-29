/**
 * What changed between two saves of a cabinet estimate - recorded in
 * CabinetEstimateHistory (one row per change: fieldName / oldValue / newValue)
 * and turned back into readable text for the Estimate History dialog, e.g.
 * "+2 B9", "Color: -White, +Blue".
 *
 * Pure functions - safe for both the API routes and the browser.
 */

export type EstimateChange = {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
};

type ChangeLine = {
  qty?: number | string | null;
  code?: string | null;
  description?: string | null;
};

type ChangeSnapshot = {
  customerName?: string | null;
  jobName?: string | null;
  brand?: string | null;
  groupColor?: string | null;
  projectType?: string | null;
  installationTypeName?: string | null;
  removal?: string | null;
  discountPercent?: number | string | null;
  microwaveInstallation?: boolean | null;
  notes?: string | null;
  total?: number | string | null;
  lineItems?: ChangeLine[];
  specialCustomizationLines?: { itemId?: string | null; qty?: number | string | null }[];
};

const ITEM_PREFIX = "item:";

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function lineQuantities(lines: ChangeLine[] | undefined): Map<string, { label: string; qty: number }> {
  const out = new Map<string, { label: string; qty: number }>();
  for (const line of lines || []) {
    const label = text(line.code) || text(line.description);
    const qty = num(line.qty);
    if (!label || qty === 0) continue;
    const key = label.toUpperCase();
    const current = out.get(key);
    if (current) current.qty += qty;
    else out.set(key, { label, qty });
  }
  return out;
}

function specialQuantities(lines: ChangeSnapshot["specialCustomizationLines"]): string {
  return (lines || [])
    .filter((l) => text(l.itemId) && num(l.qty) !== 0)
    .map((l) => `${text(l.itemId)}x${num(l.qty)}`)
    .sort()
    .join("|");
}

/** The differences between the previously saved estimate and the one being saved. */
export function computeEstimateChanges(prev: ChangeSnapshot, next: ChangeSnapshot): EstimateChange[] {
  const changes: EstimateChange[] = [];

  const simple: [string, unknown, unknown][] = [
    ["customer", prev.customerName, next.customerName],
    ["job", prev.jobName, next.jobName],
    ["brand", prev.brand, next.brand],
    ["color", prev.groupColor, next.groupColor],
    ["projectType", prev.projectType, next.projectType],
    ["installation", prev.installationTypeName, next.installationTypeName],
    ["removal", prev.removal, next.removal],
  ];
  for (const [fieldName, before, after] of simple) {
    if (text(before) !== text(after)) {
      changes.push({ fieldName, oldValue: text(before) || null, newValue: text(after) || null });
    }
  }

  if (num(prev.discountPercent) !== num(next.discountPercent)) {
    changes.push({
      fieldName: "discount",
      oldValue: String(num(prev.discountPercent)),
      newValue: String(num(next.discountPercent)),
    });
  }
  if (Boolean(prev.microwaveInstallation) !== Boolean(next.microwaveInstallation)) {
    changes.push({
      fieldName: "microwave",
      oldValue: prev.microwaveInstallation ? "yes" : "no",
      newValue: next.microwaveInstallation ? "yes" : "no",
    });
  }

  // Items: quantity per code (added, removed or a different quantity).
  const before = lineQuantities(prev.lineItems);
  const after = lineQuantities(next.lineItems);
  const keys = new Set<string>([...Array.from(before.keys()), ...Array.from(after.keys())]);
  for (const key of Array.from(keys)) {
    const b = before.get(key);
    const a = after.get(key);
    const oldQty = b?.qty ?? 0;
    const newQty = a?.qty ?? 0;
    if (oldQty !== newQty) {
      changes.push({
        fieldName: `${ITEM_PREFIX}${(a || b)!.label}`,
        oldValue: String(oldQty),
        newValue: String(newQty),
      });
    }
  }

  if (specialQuantities(prev.specialCustomizationLines) !== specialQuantities(next.specialCustomizationLines)) {
    changes.push({ fieldName: "special", oldValue: null, newValue: null });
  }
  if (text(prev.notes) !== text(next.notes)) {
    changes.push({ fieldName: "notes", oldValue: null, newValue: null });
  }

  const oldTotal = Math.round(num(prev.total) * 100) / 100;
  const newTotal = Math.round(num(next.total) * 100) / 100;
  if (oldTotal !== newTotal) {
    changes.push({ fieldName: "total", oldValue: String(oldTotal), newValue: String(newTotal) });
  }
  return changes;
}

function money(value: string | null): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num(value));
}

const FIELD_LABELS: Record<string, string> = {
  customer: "Customer",
  job: "Job",
  brand: "Brand",
  color: "Color",
  projectType: "Project type",
  installation: "Installation",
  removal: "Removal",
};

export type ChangeTone = "add" | "remove" | "change" | "neutral";
export type ChangePart = { text: string; tone: ChangeTone };

/** One history row as colored parts (green = added, red = removed, blue = changed), or null when it is not a change detail. */
export function describeEstimateChangeParts(entry: {
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
}): ChangePart[] | null {
  const { action, fieldName, oldValue, newValue } = entry;
  if (action === "CHANGED" || action === "UPDATED") {
    if (!fieldName) return null;
    if (fieldName.startsWith(ITEM_PREFIX)) {
      const code = fieldName.slice(ITEM_PREFIX.length);
      const before = num(oldValue);
      const after = num(newValue);
      if (before === 0) return [{ text: `+${after} ${code} (added)`, tone: "add" }];
      if (after === 0) return [{ text: `-${before} ${code} (removed)`, tone: "remove" }];
      const delta = after - before;
      return [
        {
          text: `${delta > 0 ? "+" : ""}${delta} ${code} (${before} → ${after})`,
          tone: delta > 0 ? "add" : "remove",
        },
      ];
    }
    if (FIELD_LABELS[fieldName]) {
      const parts: ChangePart[] = [{ text: `${FIELD_LABELS[fieldName]}: `, tone: "neutral" }];
      if (oldValue) parts.push({ text: `-${oldValue}`, tone: "remove" });
      if (oldValue && newValue) parts.push({ text: ", ", tone: "neutral" });
      if (newValue) parts.push({ text: `+${newValue}`, tone: "add" });
      return parts;
    }
    if (fieldName === "discount") {
      return [{ text: `Discount: ${num(oldValue)}% → ${num(newValue)}%`, tone: "change" }];
    }
    if (fieldName === "microwave") {
      return newValue === "yes"
        ? [{ text: "Microwave installation added", tone: "add" }]
        : [{ text: "Microwave installation removed", tone: "remove" }];
    }
    if (fieldName === "special") return [{ text: "Special customization items changed", tone: "change" }];
    if (fieldName === "notes") return [{ text: "Notes edited", tone: "change" }];
    if (fieldName === "total") {
      return [{ text: `Total: ${money(oldValue)} → ${money(newValue)}`, tone: "change" }];
    }
    return [{ text: `${fieldName}: ${oldValue ?? "-"} → ${newValue ?? "-"}`, tone: "change" }];
  }
  if (action === "CREATED") {
    if (fieldName === "revisionOf") {
      return [{ text: `Edited from ${oldValue || "an earlier estimate"}`, tone: "neutral" }];
    }
    if (fieldName === "remeasureOf") return [{ text: `Remeasure of ${newValue || "an estimate"}`, tone: "neutral" }];
    return [{ text: "Estimate created", tone: "neutral" }];
  }
  if (action === "REVISED" || (action === "ARCHIVED" && fieldName === "replacedBy")) {
    return [{ text: `Edited in ${newValue || "a newer version"}`, tone: "neutral" }];
  }
  return null;
}

export function describeEstimateAction(action: string): string {
  switch (action) {
    case "CREATED":
      return "Created";
    case "CHANGED":
    case "UPDATED":
      return "Changed";
    case "REVISED":
      return "Edited";
    case "ARCHIVED":
      return "Archived";
    case "RESTORED":
      return "Restored";
    default:
      return action;
  }
}
