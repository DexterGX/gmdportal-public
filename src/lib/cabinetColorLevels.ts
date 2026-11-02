import type { NormalizedImportItem } from "@/lib/cabinetCatalogImport";

/**
 * Some vendors sell dozens of colors that are priced in a handful of Levels
 * (Level 1, 2, 3, 4...). Importing one price column per color makes the review
 * screen huge and slow, and every column holds the same numbers as its
 * neighbors. This helper detects that structure and collapses the price
 * columns to one per Level, keeping a separate list of which Level every
 * color belongs to (shown in the estimate as "Level 1 - Ivory White Shaker IWS").
 */

export type ColorGroupColor = {
  /** Text shown in the estimate's Group / Color list, e.g. "Level 1 - Ivory White Shaker IWS". */
  label: string;
  /** Color name without level or code, e.g. "Ivory White Shaker". */
  name: string;
  /** Short color code, e.g. "IWS" (empty when none). */
  code: string;
};

export type ColorGroup = {
  /** Level number (1, 2, 3...). */
  level: number;
  /** Name of the price column / tier for this level, e.g. "Level 1". */
  levelName: string;
  colors: ColorGroupColor[];
};

export type ColorMode = "auto" | "levels" | "columns";

export type CollapseResult = {
  items: NormalizedImportItem[];
  /** Null when the columns were left as they are. */
  colorGroups: ColorGroup[] | null;
  notes: string[];
};

/** At least this many price columns before grouping is worth it in "auto" mode. */
const MIN_COLUMNS_FOR_AUTO = 8;

const LEVEL_RE = /^(?:level|lvl|lv)\.?\s*(\d+)\s*(?:[-–—:]\s*)?(.*)$/i;

export function levelTierName(level: number): string {
  return `Level ${level}`;
}

export function colorLabel(level: number, rest: string): string {
  const clean = rest.trim();
  return clean ? `${levelTierName(level)} - ${clean}` : levelTierName(level);
}

/** "Lv1 - White Oak VTW" -> { level: 1, name: "White Oak", code: "VTW" } */
export function parseLevelColumn(
  tierName: string,
): { level: number; name: string; code: string; rest: string } | null {
  const m = LEVEL_RE.exec(tierName.trim());
  if (!m) return null;
  const level = Number(m[1]);
  if (!Number.isFinite(level) || level <= 0) return null;
  const rest = m[2].trim();
  const tokens = rest.split(/\s+/).filter(Boolean);
  let code = "";
  let name = rest;
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    if (/^[A-Z0-9]{2,8}$/.test(last) && /[A-Z]/.test(last)) {
      code = last;
      name = tokens.slice(0, -1).join(" ");
    }
  }
  return { level, name, code, rest };
}

function priceOf(item: NormalizedImportItem, tierName: string): number | null {
  const p = item.prices.find((x) => x.tierName === tierName);
  return p ? p.price : null;
}

function orderedTierNames(items: NormalizedImportItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    for (const p of item.prices) {
      if (!seen.has(p.tierName)) {
        seen.add(p.tierName);
        out.push(p.tierName);
      }
    }
  }
  return out;
}

type Grouping = {
  /** level number -> list of [tierName, color] in column order */
  groups: Map<number, { tierName: string; color: ColorGroupColor }[]>;
  /** tier names that stay as they are (not part of any level) */
  untouched: string[];
};

function groupByLevelNames(tierNames: string[]): Grouping | null {
  const groups = new Map<number, { tierName: string; color: ColorGroupColor }[]>();
  const untouched: string[] = [];
  for (const tierName of tierNames) {
    const parsed = parseLevelColumn(tierName);
    if (!parsed) {
      untouched.push(tierName);
      continue;
    }
    const list = groups.get(parsed.level) || [];
    list.push({
      tierName,
      color: {
        label: colorLabel(parsed.level, parsed.rest),
        name: parsed.name,
        code: parsed.code,
      },
    });
    groups.set(parsed.level, list);
  }
  if (groups.size === 0) return null;
  return { groups, untouched };
}

/** Columns with identical prices on every item are one Level (used when the headers carry no level numbers). */
function groupByPriceVector(items: NormalizedImportItem[], tierNames: string[]): Grouping | null {
  const byVector = new Map<string, string[]>();
  for (const tierName of tierNames) {
    const key = items.map((it) => priceOf(it, tierName)).join("|");
    const list = byVector.get(key) || [];
    list.push(tierName);
    byVector.set(key, list);
  }
  const clusters = Array.from(byVector.entries()).map(([key, names]) => {
    const nums = key
      .split("|")
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    return { names, avg };
  });
  clusters.sort((a, b) => a.avg - b.avg);
  const groups = new Map<number, { tierName: string; color: ColorGroupColor }[]>();
  clusters.forEach((cluster, idx) => {
    const level = idx + 1;
    groups.set(
      level,
      cluster.names.map((tierName) => ({
        tierName,
        color: { label: colorLabel(level, tierName), name: tierName, code: "" },
      })),
    );
  });
  return { groups, untouched: [] };
}

/** Share of (item, level) cells where colors of the same level disagree on price. */
function mismatchRate(items: NormalizedImportItem[], grouping: Grouping): number {
  let cells = 0;
  let bad = 0;
  for (const list of grouping.groups.values()) {
    if (list.length < 2) continue;
    for (const item of items) {
      const values = list.map((c) => priceOf(item, c.tierName));
      cells++;
      if (values.some((v) => v !== values[0])) bad++;
    }
  }
  return cells === 0 ? 0 : bad / cells;
}

type Renumbered = {
  items: NormalizedImportItem[];
  colorGroups: ColorGroup[];
  changed: boolean;
  moves: string;
};

/** Gives the levels numbers 1..n in order of their average price (cheapest = Level 1). */
function renumberLevelsByPrice(items: NormalizedImportItem[], groups: ColorGroup[]): Renumbered {
  const unchanged: Renumbered = { items, colorGroups: groups, changed: false, moves: "" };
  if (groups.length < 2) return unchanged;

  const names = groups.map((g) => g.levelName);
  // Compare on the items that have a price in every level, so a level that is
  // missing from many rows is not judged cheaper just because of that.
  const complete = items.filter((it) => names.every((n) => priceOf(it, n) !== null));
  const sample = complete.length >= 5 ? complete : items;
  const average = (name: string): number => {
    let sum = 0;
    let count = 0;
    for (const it of sample) {
      const v = priceOf(it, name);
      if (v !== null && v > 0) {
        sum += v;
        count++;
      }
    }
    return count === 0 ? Number.POSITIVE_INFINITY : sum / count;
  };
  const ranked = groups
    .map((g, index) => ({ g, index, avg: average(g.levelName) }))
    .sort((a, b) => a.avg - b.avg || a.index - b.index);
  if (ranked.every((r, i) => r.index === i)) return unchanged;

  const newLevelByOld = new Map<number, number>();
  ranked.forEach((r, i) => newLevelByOld.set(r.g.level, i + 1));
  const newNameByOld = new Map<string, string>();
  for (const g of groups) newNameByOld.set(g.levelName, levelTierName(newLevelByOld.get(g.level) as number));

  const colorGroups: ColorGroup[] = ranked.map((r, i) => {
    const level = i + 1;
    return {
      level,
      levelName: levelTierName(level),
      colors: r.g.colors.map((c) => {
        const parsed = parseLevelColumn(c.label);
        return { ...c, label: colorLabel(level, parsed ? parsed.rest : c.name) };
      }),
    };
  });
  const columnRank = (tierName: string): number => {
    const m = /^Level (\d+)$/.exec(tierName);
    return m ? Number(m[1]) : 1000;
  };
  const remapped = items.map((it) => ({
    ...it,
    prices: it.prices
      .map((p) => {
        const renamed = newNameByOld.get(p.tierName);
        return renamed ? { ...p, tierName: renamed } : p;
      })
      .sort((a, b) => columnRank(a.tierName) - columnRank(b.tierName)),
  }));
  const moves = groups
    .filter((g) => newLevelByOld.get(g.level) !== g.level)
    .map((g) => `Level ${g.level} is now Level ${newLevelByOld.get(g.level)}`)
    .join(", ");
  return { items: remapped, colorGroups, changed: true, moves };
}

export function collapseColorLevels(items: NormalizedImportItem[], mode: ColorMode): CollapseResult {
  const none = (notes: string[] = []): CollapseResult => ({ items, colorGroups: null, notes });
  if (mode === "columns" || items.length === 0) return none();

  const tierNames = orderedTierNames(items);
  const forced = mode === "levels";
  if (!forced && tierNames.length < MIN_COLUMNS_FOR_AUTO) return none();

  let grouping = groupByLevelNames(tierNames);
  let fromNames = true;
  if (!grouping) {
    grouping = groupByPriceVector(items, tierNames);
    fromNames = false;
  }
  if (!grouping) return none();

  const colorCount = Array.from(grouping.groups.values()).reduce((n, l) => n + l.length, 0);
  const levelCount = grouping.groups.size;

  if (!forced) {
    // "Many colors" under "a few levels": the columns would repeat the same prices.
    if (colorCount < MIN_COLUMNS_FOR_AUTO || levelCount * 2 > colorCount) return none();
    if (!fromNames && levelCount > 8) return none();
  } else if (colorCount === levelCount && fromNames) {
    // Nothing to collapse: one column per level already.
    return none();
  }

  const notes: string[] = [];
  const rate = mismatchRate(items, grouping);
  if (!forced && rate > 0.02) {
    return none([
      `Colors look like they are grouped in levels, but some colors of the same level have different prices (${Math.round(rate * 100)}% of the cells), so every color column was kept.`,
    ]);
  }
  if (rate > 0) {
    notes.push(
      `Some colors in the same level had different prices (${Math.round(rate * 1000) / 10}% of the cells); the first color of each level was used.`,
    );
  }

  const levels = Array.from(grouping.groups.keys()).sort((a, b) => a - b);
  const colorGroups: ColorGroup[] = levels.map((level) => ({
    level,
    levelName: levelTierName(level),
    colors: grouping!.groups.get(level)!.map((c) => c.color),
  }));
  // Representative (first) column of each level, which supplies the price.
  const sourceByLevel = new Map<number, string[]>();
  for (const level of levels) {
    sourceByLevel.set(
      level,
      grouping.groups.get(level)!.map((c) => c.tierName),
    );
  }
  const untouched = new Set(grouping.untouched);

  const collapsed = items.map((item) => {
    const prices: NormalizedImportItem["prices"] = [];
    for (const level of levels) {
      let found: number | null = null;
      for (const tierName of sourceByLevel.get(level)!) {
        const v = priceOf(item, tierName);
        if (v !== null) {
          found = v;
          break;
        }
      }
      if (found !== null) prices.push({ tierName: levelTierName(level), price: found });
    }
    for (const p of item.prices) {
      if (untouched.has(p.tierName)) prices.push(p);
    }
    return { ...item, prices };
  });

  // Levels read lowest -> highest price. A file that does not print its level
  // numbers can end up with Level 2 cheaper than Level 1, so renumber them by price.
  const renumbered = renumberLevelsByPrice(collapsed, colorGroups);
  if (renumbered.changed) {
    notes.push(
      `Levels were renumbered from the lowest to the highest price (${renumbered.moves}).`,
    );
  }

  notes.push(
    `${colorCount} colors were grouped into ${levelCount} level${levelCount === 1 ? "" : "s"} (${renumbered.colorGroups
      .map((g) => `${g.levelName}: ${g.colors.length}`)
      .join(", ")}). Only the levels are price columns; each color keeps its level.`,
  );
  return { items: renumbered.items, colorGroups: renumbered.colorGroups, notes };
}
