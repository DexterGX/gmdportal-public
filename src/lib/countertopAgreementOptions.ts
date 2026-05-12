export type CountertopImageCategory = "sink" | "thickness" | "edge";

export type CountertopImageOption = {
  optionKey: string;
  optionLabel: string;
};

export const COUNTERTOP_SINK_OPTIONS: CountertopImageOption[] = [
  { optionKey: "no-sink", optionLabel: "No Sink" },
  {
    optionKey: "gmd-fabricated-sink-slanted",
    optionLabel: "GMD Fabricated Sink Slanted",
  },
  {
    optionKey: "gmd-fabricated-sink-integrated",
    optionLabel: "GMD Fabricated Sink Integrated",
  },
  {
    optionKey: "gmd-kitchen-bathroom-sink",
    optionLabel: "GMD Kitchen/Bathroom Sink",
  },
  { optionKey: "gmd-sink", optionLabel: "GMD Sink (Generic)" },
  { optionKey: "client-sink", optionLabel: "Client Sink" },
];

export const COUNTERTOP_THICKNESS_OPTIONS: CountertopImageOption[] = [
  { optionKey: "2cm", optionLabel: "2CM" },
  { optionKey: "3cm", optionLabel: "3CM" },
  { optionKey: "2cm-build-up", optionLabel: "2CM Build-UP" },
  { optionKey: "3cm-build-up", optionLabel: "3CM Build-UP" },
];

export const COUNTERTOP_EDGE_PROFILE_OPTIONS: CountertopImageOption[] = [
  { optionKey: "flat-polished", optionLabel: "Flat Polished" },
  { optionKey: "beveled-1-4", optionLabel: "Beveled 1/4" },
  { optionKey: "beveled-1-2", optionLabel: "Beveled 1/2" },
  { optionKey: "beveled-3-4", optionLabel: "Beveled 3/4" },
  { optionKey: "half-bullnose", optionLabel: "Half Bullnose" },
  { optionKey: "full-bullnose", optionLabel: "Full Bullnose" },
  { optionKey: "mitered", optionLabel: "Mitered" },
  { optionKey: "waterfall", optionLabel: "Waterfall" },
];

export const COUNTERTOP_IMAGE_OPTIONS_BY_CATEGORY: Record<
  CountertopImageCategory,
  CountertopImageOption[]
> = {
  sink: COUNTERTOP_SINK_OPTIONS,
  thickness: COUNTERTOP_THICKNESS_OPTIONS,
  edge: COUNTERTOP_EDGE_PROFILE_OPTIONS,
};

export function normalizeOptionKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
