"use client";

import { useState } from "react";
import { Calculator, ChevronDown, ChevronRight } from "lucide-react";

export type PricingFormulaSection =
  | "LED_STRIP"
  | "LED_SHEET"
  | "MIRROR"
  | "GLASS_DOOR_SHELF"
  | "ISLAND_PANEL"
  | "WALL_UNIT"
  | "MIRROR_FRAME";

type Named = { name: string; active: boolean };

export interface PricingFormulaData {
  ledTypes: Array<Named & { minimumPriceUnder25Ft: number; pricePerFt: number }>;
  profiles: Array<Named & { unitPrice: number; groovePricePerFt: number }>;
  sheetTypes: Array<Named & { unitPrice: number; minimumPrice: number }>;
  mirrorColors: Array<Named & { venda: number }>;
  mirrorBevelOptions: Array<Named & { venda: number }>;
  glassDoorShelfTypes: Array<Named & { venda: number }>;
  islandPanelModels: Array<Named & { sfPerBox: number; salesPrice: number }>;
  mirrorFrameFinishes: Array<Named & { pricePerLinearFt: number }>;
  mirrorSetting: {
    cuttingFee: number;
    outletSale: number;
    lightCutoutSale: number;
    outOfSquareBeveledSale: number;
    removalPricePerSqFt: number;
    repairWallMultiplier: number;
  };
  wallUnitSetting: { constructionPricePerSqFt: number };
  mirrorFrameSetting: { minimumCharge: number; paintingFactor: number };
}

type ValueTable = {
  heading: string;
  columns: string[];
  rows: string[][];
  empty: string;
};

type FormulaBlock = {
  title: string;
  steps: Array<{ label: string; formula: string }>;
  notes?: string[];
  tables?: ValueTable[];
  settings?: Array<{ label: string; value: string }>;
  example: { description: string; lines: string[] } | null;
  exampleEmpty?: string;
};

const SECTION_LABELS: Record<PricingFormulaSection, string> = {
  LED_STRIP: "LED Strip",
  LED_SHEET: "LED Sheet",
  MIRROR: "Mirror & Mirror Removal",
  GLASS_DOOR_SHELF: "Glass Door/Shelf",
  ISLAND_PANEL: "Island Panel",
  WALL_UNIT: "Wall Unit",
  MIRROR_FRAME: "Mirror Frame",
};

function safe(value: number) {
  return Number.isFinite(value) ? value : 0;
}

/** Totals: always 2 decimals. */
function money(value: number) {
  return `$${safe(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Unit prices: keep extra precision (e.g. $0.125 per inch). */
function rate(value: number) {
  return `$${safe(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

function num(value: number) {
  return safe(value).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function activeOnly<T extends Named>(items: T[]) {
  return items.filter((item) => item.active);
}

function isChargeableBevel(name: string) {
  const normalized = name.trim().toLowerCase();
  return Boolean(normalized) && normalized !== "no";
}

const SQFT_STEP = {
  label: "Square Feet",
  formula: "(Width × Height) ÷ 144   (Width and Height in inches)",
};

function buildBlocks(
  section: PricingFormulaSection,
  d: PricingFormulaData,
): FormulaBlock[] {
  switch (section) {
    case "LED_STRIP": {
      const ledTypes = activeOnly(d.ledTypes);
      const profiles = activeOnly(d.profiles);
      const exType = ledTypes[0];
      const exProfile = profiles.find(
        (item) => item.name.trim().toLowerCase() === "yes",
      );
      let example: FormulaBlock["example"] = null;
      if (exType) {
        const lf = 40;
        const base =
          exType.minimumPriceUnder25Ft + (lf - 25) * exType.pricePerFt;
        const lines = [
          `LED Base = ${rate(exType.minimumPriceUnder25Ft)} + (${lf} − 25) × ${rate(exType.pricePerFt)} = ${money(base)}`,
        ];
        let profileCharge = 0;
        if (exProfile) {
          const qty = Math.ceil(lf / 8);
          profileCharge =
            qty * exProfile.unitPrice + lf * exProfile.groovePricePerFt;
          lines.push(`Profile Qty = ${lf} ÷ 8 = ${qty}`);
          lines.push(
            `Profile Charge = ${qty} × ${rate(exProfile.unitPrice)} + ${lf} × ${rate(exProfile.groovePricePerFt)} = ${money(profileCharge)}`,
          );
        }
        lines.push(
          `Sales Price = ${money(base)} + ${money(profileCharge)} = ${money(base + profileCharge)}`,
        );
        example = {
          description: `${lf} ft of ${exType.name}${exProfile ? ", Profile = Yes" : ", no profile"}`,
          lines,
        };
      }
      return [
        {
          title: "LED Strip",
          steps: [
            {
              label: "LED Base Price",
              formula:
                "If Linear Ft ≤ 25:  LED Minimum Price (up to 25 ft)\nIf Linear Ft > 25:  LED Minimum Price + (Linear Ft − 25) × Price per Extra Ft",
            },
            {
              label: "Profile Qty",
              formula: "Linear Ft ÷ 8, rounded up   (only when Profile = Yes)",
            },
            {
              label: "Profile Charge",
              formula:
                "(Profile Qty × Profile Price per 8 ft) + (Linear Ft × Groove Price per Ft)",
            },
            {
              label: "Sales Price",
              formula: "LED Base Price + Profile Charge",
            },
          ],
          notes: [
            "Profile Qty and Profile Charge are 0 when Profile is not set to Yes.",
            "Control Type is recorded on the row but does not change the price.",
          ],
          tables: [
            {
              heading: "LED Types",
              columns: ["LED Type", "Minimum (up to 25 ft)", "Price per Extra Ft"],
              rows: ledTypes.map((item) => [
                item.name,
                rate(item.minimumPriceUnder25Ft),
                rate(item.pricePerFt),
              ]),
              empty: "No active LED types.",
            },
            {
              heading: "Profiles",
              columns: ["Profile", "Price per 8 ft", "Groove Price per Ft"],
              rows: profiles.map((item) => [
                item.name,
                rate(item.unitPrice),
                rate(item.groovePricePerFt),
              ]),
              empty: "No active profiles.",
            },
          ],
          example,
          exampleEmpty: "Add an active LED type to see an example.",
        },
      ];
    }

    case "LED_SHEET": {
      const sheetTypes = activeOnly(d.sheetTypes);
      const exType = sheetTypes[0];
      let example: FormulaBlock["example"] = null;
      if (exType) {
        const w = 24;
        const h = 48;
        const sqft = Math.ceil((w * h) / 144);
        const sheetPrice = sqft * exType.unitPrice;
        const total = Math.max(exType.minimumPrice, sheetPrice);
        example = {
          description: `${w}" × ${h}" ${exType.name}`,
          lines: [
            `Square Feet = ${w} × ${h} ÷ 144 = ${sqft}`,
            `Sheet Price = ${sqft} × ${rate(exType.unitPrice)} = ${money(sheetPrice)}`,
            `Sales Price = higher of ${money(sheetPrice)} or ${money(exType.minimumPrice)} = ${money(total)}`,
          ],
        };
      }
      return [
        {
          title: "LED Sheet",
          steps: [
            {
              label: "Square Feet",
              formula:
                "(Width × Height) ÷ 144, rounded up to a whole number   (inches)",
            },
            {
              label: "Sheet Price",
              formula: "Square Feet × Sheet Type Price per Sq Ft",
            },
            {
              label: "Sales Price",
              formula: "The higher of Sheet Price or Sheet Type Minimum Price",
            },
          ],
          notes: [
            "Control Type is recorded on the row but does not change the price.",
          ],
          tables: [
            {
              heading: "Sheet Types",
              columns: ["Sheet Type", "Price per Sq Ft", "Minimum Price"],
              rows: sheetTypes.map((item) => [
                item.name,
                rate(item.unitPrice),
                money(item.minimumPrice),
              ]),
              empty: "No active sheet types.",
            },
          ],
          example,
          exampleEmpty: "Add an active sheet type to see an example.",
        },
      ];
    }

    case "MIRROR": {
      const colors = activeOnly(d.mirrorColors);
      const bevels = activeOnly(d.mirrorBevelOptions);
      const s = d.mirrorSetting;
      const exColor = colors[0];
      const exBevel = bevels.find((item) => isChargeableBevel(item.name));
      const w = 36;
      const h = 48;
      const sqft = (w * h) / 144;
      const perimeter = w * 2 + h * 2;

      let mirrorExample: FormulaBlock["example"] = null;
      if (exColor) {
        const base = sqft * exColor.venda;
        const outlets = 1;
        const outletCharge = outlets * s.outletSale;
        const bevelCharge = exBevel
          ? perimeter * exBevel.venda + s.outOfSquareBeveledSale
          : 0;
        const lines = [
          `Square Feet = ${w} × ${h} ÷ 144 = ${num(sqft)}`,
          `Base = ${num(sqft)} × ${rate(exColor.venda)} = ${money(base)}`,
          `Outlets = ${outlets} × ${rate(s.outletSale)} = ${money(outletCharge)}`,
        ];
        if (exBevel) {
          lines.push(
            `Bevel = (${perimeter} × ${rate(exBevel.venda)}) + ${money(s.outOfSquareBeveledSale)} = ${money(bevelCharge)}`,
          );
        }
        lines.push(
          `Sales Price = ${money(base)} + ${money(outletCharge)}${exBevel ? ` + ${money(bevelCharge)}` : ""} = ${money(base + outletCharge + bevelCharge)}`,
        );
        mirrorExample = {
          description: `${w}" × ${h}" ${exColor.name}, 1 outlet, no light cutouts${exBevel ? `, bevel ${exBevel.name}` : ", not beveled"}`,
          lines,
        };
      }

      const removal = sqft * s.removalPricePerSqFt;
      const repair = removal * s.repairWallMultiplier;

      return [
        {
          title: "Mirror",
          steps: [
            SQFT_STEP,
            {
              label: "Base Price",
              formula: "Square Feet × Mirror Color Price per Sq Ft",
            },
            {
              label: "Outlets & Cutouts",
              formula:
                "(Outlets × Outlet Price) + (Light Cutouts × Light Cutout Price)",
            },
            {
              label: "Bevel Charge",
              formula:
                "Only if beveled:  (Perimeter × Bevel Price per Inch) + Out-of-Square Beveled Fee\nPerimeter = (Width × 2) + (Height × 2), in inches",
            },
            {
              label: "Sales Price",
              formula: "Base Price + Outlets & Cutouts + Bevel Charge",
            },
          ],
          notes: [
            "A bevel option named \"No\" counts as not beveled (no bevel charge, no out-of-square fee).",
            "The row stays at $0 until a mirror color is picked.",
          ],
          tables: [
            {
              heading: "Mirror Colors",
              columns: ["Color", "Price per Sq Ft"],
              rows: colors.map((item) => [item.name, rate(item.venda)]),
              empty: "No active mirror colors.",
            },
            {
              heading: "Bevel Options",
              columns: ["Bevel Option", "Price per Inch"],
              rows: bevels.map((item) => [
                item.name,
                isChargeableBevel(item.name) ? rate(item.venda) : "Not charged",
              ]),
              empty: "No active bevel options.",
            },
          ],
          settings: [
            { label: "Outlet Price", value: rate(s.outletSale) },
            { label: "Light Cutout Price", value: rate(s.lightCutoutSale) },
            {
              label: "Out-of-Square Beveled Fee",
              value: money(s.outOfSquareBeveledSale),
            },
          ],
          example: mirrorExample,
          exampleEmpty: "Add an active mirror color to see an example.",
        },
        {
          title: "Mirror Removal",
          steps: [
            SQFT_STEP,
            {
              label: "Removal Price",
              formula: "Square Feet × Removal Price per Sq Ft",
            },
            {
              label: "Repair Wall Charge",
              formula:
                "Only if Repair Wall = YES:  Removal Price × Repair Wall Multiplier",
            },
            {
              label: "Sales Price",
              formula: "Removal Price + Repair Wall Charge",
            },
          ],
          settings: [
            {
              label: "Removal Price per Sq Ft",
              value: rate(s.removalPricePerSqFt),
            },
            {
              label: "Repair Wall Multiplier",
              value: num(s.repairWallMultiplier),
            },
          ],
          example: {
            description: `${w}" × ${h}" mirror removal with Repair Wall = YES`,
            lines: [
              `Square Feet = ${w} × ${h} ÷ 144 = ${num(sqft)}`,
              `Removal Price = ${num(sqft)} × ${rate(s.removalPricePerSqFt)} = ${money(removal)}`,
              `Repair Wall Charge = ${money(removal)} × ${num(s.repairWallMultiplier)} = ${money(repair)}`,
              `Sales Price = ${money(removal)} + ${money(repair)} = ${money(removal + repair)}`,
            ],
          },
        },
      ];
    }

    case "GLASS_DOOR_SHELF": {
      const types = activeOnly(d.glassDoorShelfTypes);
      const cuttingFee = d.mirrorSetting.cuttingFee;
      const exType = types[0];
      let example: FormulaBlock["example"] = null;
      if (exType) {
        const w = 24;
        const h = 36;
        const qty = 2;
        const sqft = (w * h) / 144;
        const glass = sqft * exType.venda * qty;
        const cutting = cuttingFee * qty;
        example = {
          description: `${qty} pieces of ${w}" × ${h}" ${exType.name}`,
          lines: [
            `Square Feet = ${w} × ${h} ÷ 144 = ${num(sqft)}`,
            `Glass Price = ${num(sqft)} × ${rate(exType.venda)} × ${qty} = ${money(glass)}`,
            `Cutting = ${money(cuttingFee)} × ${qty} = ${money(cutting)}`,
            `Sales Price = ${money(glass)} + ${money(cutting)} = ${money(glass + cutting)}`,
          ],
        };
      }
      return [
        {
          title: "Glass Door/Shelf",
          steps: [
            SQFT_STEP,
            {
              label: "Glass Price",
              formula: "Square Feet × Glass Type Price per Sq Ft × Quantity",
            },
            {
              label: "Cutting Charge",
              formula: "Cutting Fee × Quantity",
            },
            {
              label: "Sales Price",
              formula: "Glass Price + Cutting Charge",
            },
          ],
          notes: [
            "The Cutting Fee is shared with mirrors and is edited under the Mirror tab (Mirror Formula Values).",
          ],
          tables: [
            {
              heading: "Glass Types",
              columns: ["Glass Type", "Price per Sq Ft"],
              rows: types.map((item) => [item.name, rate(item.venda)]),
              empty: "No active glass types.",
            },
          ],
          settings: [{ label: "Cutting Fee (per piece)", value: money(cuttingFee) }],
          example,
          exampleEmpty: "Add an active glass type to see an example.",
        },
      ];
    }

    case "ISLAND_PANEL": {
      const models = activeOnly(d.islandPanelModels);
      const exModel = models.find((item) => item.sfPerBox > 0);
      let example: FormulaBlock["example"] = null;
      if (exModel) {
        const w = 36;
        const h = 96;
        const sqft = (w * h) / 144;
        const boxes = Math.ceil(sqft / exModel.sfPerBox);
        example = {
          description: `${w}" × ${h}" panel in ${exModel.name}`,
          lines: [
            `Square Feet = ${w} × ${h} ÷ 144 = ${num(sqft)}`,
            `Box Qty = ${num(sqft)} ÷ ${num(exModel.sfPerBox)} = ${num(sqft / exModel.sfPerBox)} → ${boxes} box${boxes === 1 ? "" : "es"} (rounded up)`,
            `Sales Price = ${boxes} × ${money(exModel.salesPrice)} = ${money(boxes * exModel.salesPrice)}`,
          ],
        };
      }
      return [
        {
          title: "Island Panel",
          steps: [
            SQFT_STEP,
            {
              label: "Box Qty",
              formula: "Square Feet ÷ Sq Ft per Box, rounded up",
            },
            {
              label: "Sales Price",
              formula: "Box Qty × Panel Model Price per Box",
            },
          ],
          tables: [
            {
              heading: "Panel Models",
              columns: ["Panel Model", "Sq Ft per Box", "Price per Box"],
              rows: models.map((item) => [
                item.name,
                num(item.sfPerBox),
                money(item.salesPrice),
              ]),
              empty: "No active panel models.",
            },
          ],
          example,
          exampleEmpty:
            "Add an active panel model with Sq Ft per Box above 0 to see an example.",
        },
      ];
    }

    case "WALL_UNIT": {
      const price = d.wallUnitSetting.constructionPricePerSqFt;
      const w = 96;
      const h = 84;
      const sqft = (w * h) / 144;
      return [
        {
          title: "Wall Unit",
          steps: [
            SQFT_STEP,
            {
              label: "Sales Price",
              formula: "Square Feet × Construction Price per Sq Ft",
            },
          ],
          settings: [
            { label: "Construction Price per Sq Ft", value: rate(price) },
          ],
          example: {
            description: `${w}" × ${h}" wall unit`,
            lines: [
              `Square Feet = ${w} × ${h} ÷ 144 = ${num(sqft)}`,
              `Sales Price = ${num(sqft)} × ${rate(price)} = ${money(sqft * price)}`,
            ],
          },
        },
      ];
    }

    case "MIRROR_FRAME": {
      const finishes = activeOnly(d.mirrorFrameFinishes);
      const { minimumCharge, paintingFactor } = d.mirrorFrameSetting;
      const exFinish = finishes[0];
      let example: FormulaBlock["example"] = null;
      if (exFinish) {
        const w = 36;
        const h = 48;
        const linear = (w + h) * 2;
        const frame = linear * exFinish.pricePerLinearFt;
        const base = Math.max(frame, minimumCharge);
        example = {
          description: `${w}" × ${h}" frame in ${exFinish.name}`,
          lines: [
            `Linear Inches = (${w} + ${h}) × 2 = ${linear}`,
            `Frame Price = ${linear} × ${rate(exFinish.pricePerLinearFt)} = ${money(frame)}`,
            `Not painted: higher of ${money(frame)} or ${money(minimumCharge)} = ${money(base)}`,
            `Painted: ${money(base)} × ${num(paintingFactor)} = ${money(base * paintingFactor)}`,
          ],
        };
      }
      return [
        {
          title: "Mirror Frame",
          steps: [
            {
              label: "Linear Inches",
              formula: "(Width + Height) × 2   (inches)",
            },
            {
              label: "Frame Price",
              formula: "Linear Inches × Finish Price per Linear Ft",
            },
            {
              label: "Minimum",
              formula: "If Frame Price is below the Minimum Charge, the Minimum Charge is used",
            },
            {
              label: "Sales Price",
              formula: "Not painted:  Frame Price\nPainted:  Frame Price × Painting Factor",
            },
          ],
          tables: [
            {
              heading: "Mirror Frame Finishes",
              columns: ["Finish", "Price per Linear Ft"],
              rows: finishes.map((item) => [
                item.name,
                rate(item.pricePerLinearFt),
              ]),
              empty: "No active finishes.",
            },
          ],
          settings: [
            { label: "Minimum Charge", value: money(minimumCharge) },
            { label: "Painting Factor", value: num(paintingFactor) },
          ],
          example,
          exampleEmpty: "Add an active finish to see an example.",
        },
      ];
    }

    default:
      return [];
  }
}

interface PricingFormulaPanelProps {
  section: PricingFormulaSection;
  data: PricingFormulaData;
}

export default function PricingFormulaPanel({
  section,
  data,
}: PricingFormulaPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const blocks = buildBlocks(section, data);
  const label = SECTION_LABELS[section];

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Pricing Formula: {label}
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              How the {label} price is calculated, using the current settings.
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="space-y-8">
          {blocks.map((block) => (
            <div key={block.title} className="space-y-4">
              {blocks.length > 1 && (
                <h3 className="border-b border-gray-200 pb-1 text-base font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                  {block.title}
                </h3>
              )}

              <ol className="space-y-2">
                {block.steps.map((step, index) => (
                  <li
                    key={step.label}
                    className="grid grid-cols-1 gap-1 md:grid-cols-[180px_1fr] md:gap-3"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {index + 1}. {step.label}
                    </span>
                    <span className="whitespace-pre-line rounded-md bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                      {step.formula}
                    </span>
                  </li>
                ))}
              </ol>

              {block.notes && block.notes.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-gray-500 dark:text-gray-400">
                  {block.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}

              {((block.tables && block.tables.length > 0) ||
                (block.settings && block.settings.length > 0)) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Current Values
                  </h4>

                  {block.settings && block.settings.length > 0 && (
                    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {block.settings.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
                        >
                          <dt className="text-xs text-gray-500 dark:text-gray-400">
                            {item.label}
                          </dt>
                          <dd className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {block.tables?.map((table) => (
                    <div key={table.heading} className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {table.heading}
                      </p>
                      {table.rows.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {table.empty}
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full border border-gray-200 text-sm dark:border-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                              <tr>
                                {table.columns.map((column, columnIndex) => (
                                  <th
                                    key={column}
                                    className={`border border-gray-200 px-3 py-1.5 font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200 ${
                                      columnIndex === 0 ? "text-left" : "text-right"
                                    }`}
                                  >
                                    {column}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {table.rows.map((row, rowIndex) => (
                                <tr key={`${table.heading}-${rowIndex}`}>
                                  {row.map((cell, cellIndex) => (
                                    <td
                                      key={`${table.heading}-${rowIndex}-${cellIndex}`}
                                      className={`border border-gray-200 px-3 py-1.5 text-gray-900 dark:border-gray-700 dark:text-gray-100 ${
                                        cellIndex === 0 ? "text-left" : "text-right"
                                      }`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-md border border-teal-200 bg-teal-50 p-3 dark:border-teal-900 dark:bg-teal-950/40">
                <p className="text-sm font-semibold text-teal-900 dark:text-teal-200">
                  Example{block.example ? `: ${block.example.description}` : ""}
                </p>
                {block.example ? (
                  <ul className="mt-2 space-y-1 font-mono text-xs text-teal-900 dark:text-teal-100 sm:text-sm">
                    {block.example.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-teal-900 dark:text-teal-200">
                    {block.exampleEmpty}
                  </p>
                )}
              </div>
            </div>
          ))}

          <p className="border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Estimate Total = sum of every section subtotal (LED Strip + LED
            Sheet + Glass Door/Shelf + Island Panel + Wall Unit + Mirror Frame +
            Mirror + Mirror Removal). No discount or tax is applied.
          </p>
        </div>
      )}
    </section>
  );
}
