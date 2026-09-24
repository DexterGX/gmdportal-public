// Shared by the server (key checks) and the Settings > API Keys UI.
// Scopes a key can be granted. Keep keys least-privilege: give each outside
// program only the scopes it actually needs.
export const API_SCOPES = [
  {
    id: "fabrication-orders:read",
    label: "Fabrication Orders (read)",
    description: "Countertop layouts: areas, stone, sinks, edges, measurements, drawings.",
  },
  {
    id: "accessories:read",
    label: "Accessories Tracker (read)",
    description: "Accessory items with status, dates and the job they belong to.",
  },
  {
    id: "pricing:read",
    label: "Include pricing",
    description:
      "Adds dollar amounts (order totals, area charges, accessory cost/retail). Leave off unless needed.",
  },
] as const;

export type ApiScope = (typeof API_SCOPES)[number]["id"];

export const API_SCOPE_IDS = API_SCOPES.map((scope) => scope.id) as ApiScope[];
