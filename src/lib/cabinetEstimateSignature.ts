// A canonical fingerprint of everything on a Cabinet Estimate that a user
// can change. Used when an already-saved estimate is saved again: if the
// fingerprint of what's being saved differs from what's stored, the save
// counts as a real revision (and gets a new Estimate #); if it's identical,
// nothing is written.

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
}

function day(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export type EstimateSignatureInput = {
  date: unknown;
  customerName: unknown;
  customerId: unknown;
  jobId?: unknown; // not compared - the form doesn't reload it, jobName/dealId cover it
  jobName: unknown;
  jobAddress: unknown;
  dealId: unknown;
  dealName: unknown;
  salesRep: unknown;
  brand: unknown;
  groupColor: unknown;
  vendorId: unknown;
  priceTierId: unknown;
  removalTypeId: unknown;
  installationTypeId: unknown;
  projectType: unknown;
  notes: unknown;
  microwaveInstallation: unknown;
  discountPercent: unknown;
  total: unknown;
  lineItems: {
    qty: unknown;
    code: unknown;
    description: unknown;
    note: unknown;
    isCustomization: unknown;
    unitPrice: unknown;
    catalogItemId: unknown;
  }[];
  specialCustomizationLines: { itemId: unknown; qty: unknown }[];
};

export function estimateSignature(input: EstimateSignatureInput): string {
  return JSON.stringify({
    date: day(input.date),
    customerName: str(input.customerName),
    customerId: str(input.customerId),
    jobName: str(input.jobName),
    jobAddress: str(input.jobAddress),
    dealId: str(input.dealId),
    dealName: str(input.dealName),
    salesRep: str(input.salesRep),
    brand: str(input.brand),
    groupColor: str(input.groupColor),
    vendorId: str(input.vendorId),
    priceTierId: str(input.priceTierId),
    removalTypeId: str(input.removalTypeId),
    installationTypeId: str(input.installationTypeId),
    projectType: str(input.projectType),
    notes: str(input.notes),
    microwave: Boolean(input.microwaveInstallation),
    discountPercent: Math.trunc(Number(input.discountPercent) || 0),
    total: num(input.total),
    lines: input.lineItems.map((l) => [
      num(l.qty),
      str(l.code),
      str(l.description),
      str(l.note),
      Boolean(l.isCustomization),
      num(l.unitPrice),
      str(l.catalogItemId),
    ]),
    special: input.specialCustomizationLines
      .map((l) => [str(l.itemId), num(l.qty)] as [string, number])
      .filter((l) => l[1] > 0)
      .sort((a, b) => a[0].localeCompare(b[0])),
  });
}
