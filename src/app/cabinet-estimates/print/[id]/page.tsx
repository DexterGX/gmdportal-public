import { notFound, redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import {
  computeInstallationTotal,
  computeLineItemsCustomizationSurchargeTotal,
  discountPercentLabel,
  formatCurrency,
  generateRandomDigits,
  formatEstimateReferenceNumber,
  computeCabinetsCost,
} from "@/lib/cabinetEstimateCalc";
import { findMicrowaveServiceItem } from "@/lib/cabinetEstimateParameters";
import {
  canViewCabinetCost,
  computeCostSummary,
  computeInstallerCost,
  costsByItemIdForInstaller,
} from "@/lib/cabinetCostView";
import AutoPrintClient from "./AutoPrintClient";
import PrintButton from "./PrintButton";
import InstallerPicker from "./InstallerPicker";
import CopyQBooksButton from "../../CopyQBooksButton";
import Link from "next/link";
import styles from "./page.module.css";

const prismaAny = prisma as any;

// How many Special Customization (name, qty) pairs are laid out per print
// row - matches Diego's "4 items per row, table-like" request.
const SPECIAL_CUSTOMIZATION_COLUMNS = 4;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className={styles.infoRow}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value || ""}</div>
    </div>
  );
}

export default async function CabinetEstimatePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }
  if (!canAccess) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const query = await searchParams;
  const shouldAutoPrint = query.autoprint === "1";
  // PK List: the same sheet without any prices (for production/remeasure).
  const isPkList = query.pk === "1";
  // Preco de Custo: vendor/installer cost view, admins / finance only.
  const canViewCost = canViewCabinetCost({ appRole, appRoles });
  if (query.cost === "1" && !canViewCost) {
    redirect(`/cabinet-estimates/print/${(await params).id}`);
  }
  const isCost = query.cost === "1" && !isPkList;
  const installerParam = typeof query.installer === "string" ? query.installer : "";

  const [estimate, companySettings] = await Promise.all([
    prismaAny.cabinetEstimate.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        specialCustomizationLines: {
          include: { item: true },
          orderBy: { item: { sortOrder: "asc" } },
        },
      },
    }),
    prismaAny.companyDocumentSettings.findFirst(),
  ]);

  if (!estimate) {
    notFound();
  }

  const vendorForCost = estimate.vendorId
    ? await prismaAny.cabinetVendor.findUnique({
        where: { id: estimate.vendorId },
        select: { provider: { select: { factor: true } } },
      })
    : null;
  const estimateCost = computeCabinetsCost(
    toNumber(estimate.cabinetsTotal),
    vendorForCost?.provider ? Number(vendorForCost.provider.factor) : 1,
  );

  // Preco de Custo data: installers, the selected installer's cost per
  // Installers Price Table item, tax %.
  let costInstallers: { id: string; name: string }[] = [];
  let selectedInstallerId = "";
  let costSummary = computeCostSummary({ cabinetsCost: 0, taxPercent: 0, installationCost: 0 });
  let lineFactor = 1;
  let installerMissingCount = 0;
  let selectedInstallerName = "";
  let costTaxPercentLabel = 0;
  if (isCost) {
    lineFactor = vendorForCost?.provider ? Number(vendorForCost.provider.factor) : 1;
    const [installers, serviceItems, settings] = await Promise.all([
      prismaAny.cabinetInstaller.findMany({
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true },
      }),
      prismaAny.cabinetInstallationServiceItem.findMany({
        where: { isActive: true },
        select: { id: true, description: true },
      }),
      prismaAny.cabinetEstimateParameters.findFirst(),
    ]);
    costInstallers = installers;
    selectedInstallerId = installers.some((i: any) => i.id === installerParam)
      ? installerParam
      : installers[0]?.id || "";
    selectedInstallerName =
      installers.find((i: any) => i.id === selectedInstallerId)?.name || "";
    const costRows = selectedInstallerId
      ? await prismaAny.cabinetInstallerServiceCost.findMany({
          where: { installerId: selectedInstallerId },
        })
      : [];
    const installerCost = computeInstallerCost({
      lines: estimate.lineItems.map((item: any) => ({
        qty: toNumber(item.qty),
        installationItemId: item.installationItemId,
      })),
      costsByItemId: costsByItemIdForInstaller(
        costRows.map((c: any) => ({
          installerId: c.installerId,
          itemId: c.itemId,
          cost: toNumber(c.cost),
        })),
        selectedInstallerId,
      ),
      microwave: Boolean(estimate.microwaveInstallation),
      microwaveItemId: findMicrowaveServiceItem<{ id: string; description: string }>(serviceItems)?.id,
    });
    installerMissingCount = installerCost.missingCount;
    costTaxPercentLabel = toNumber(settings?.costTaxPercent);
    costSummary = computeCostSummary({
      cabinetsCost: estimateCost,
      taxPercent: costTaxPercentLabel,
      installationCost: installerCost.amount,
    });
  }
  // PK List keeps the price columns/summary as empty placeholders.
  const money = (value: number) => (isPkList ? "" : formatCurrency(value));
  const lineCost = (value: number) => computeCabinetsCost(value, lineFactor);
  const pageTitle = `${estimate.customerName || "Client"} - ${
    isPkList ? "PK List" : isCost ? "Cost" : "Cabinet Estimate"
  } ${estimate.estimateNumber || ""}`;
  const printedOn = new Date().toLocaleString("en-US");
  const printedBy = user.name || user.email || "Unknown";
  const discountPercent = toNumber(estimate.discountPercent);
  // Admin-managed label for this discount (e.g. "Contractor"), if configured.
  let discountLabel: string | undefined;
  try {
    const option = await prismaAny.cabinetDiscountOption.findUnique({
      where: { percent: Math.trunc(discountPercent) },
    });
    if (option) discountLabel = option.label || "";
  } catch {
    discountLabel = undefined;
  }
  const specialCustomizationRows = chunkArray(
    estimate.specialCustomizationLines,
    SPECIAL_CUSTOMIZATION_COLUMNS,
  );
  const lineCustomizationSurchargeAmount = computeLineItemsCustomizationSurchargeTotal(
    estimate.lineItems.map((item: any) => ({
      qty: toNumber(item.qty),
      unitPrice: toNumber(item.unitPrice),
      isCustomization: Boolean(item.isCustomization),
      customizationValue: toNumber(item.customizationValue),
    })),
  );
  const installationTotal = computeInstallationTotal(
    toNumber(estimate.installationAmount),
    toNumber(estimate.customizationAmount),
    lineCustomizationSurchargeAmount,
  );

  return (
    <div className={styles.screen}>
      {shouldAutoPrint && <AutoPrintClient title={pageTitle} />}
      <div className="print:hidden">
        <div
          className="mx-auto mb-3 flex items-center justify-center gap-2"
          style={{ maxWidth: "850px" }}
        >
          <PrintButton />
          <Link
            href={`/cabinet-estimates/print/${id}${isPkList ? "" : "?pk=1"}`}
            className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {isPkList ? "View with prices" : "View PK List"}
          </Link>
          {canViewCost && !isPkList && (
            <Link
              href={`/cabinet-estimates/print/${id}${isCost ? "" : "?cost=1"}`}
              className="flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              {isCost ? "View with prices" : "View Preco de Custo"}
            </Link>
          )}
          {isCost && (
            <InstallerPicker installers={costInstallers} value={selectedInstallerId} />
          )}
          <CopyQBooksButton
            estimateNumber={estimate.estimateNumber}
            brand={estimate.brand}
            color={estimate.groupColor}
          />
        </div>
      </div>
      <div className={styles.sheet}>
        <div className={styles.printedBy}>
          Printed by {printedBy} on {printedOn}
        </div>

        <div className={styles.header}>
          <div className={styles.letterhead}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={companySettings?.logoUrl || "/logo.svg"}
              alt={companySettings?.companyName || "GM Design"}
              className={styles.logo}
            />
            {companySettings?.address && (
              <div className={styles.companyLine}>{companySettings.address}</div>
            )}
            {companySettings?.phoneNumber && (
              <div className={styles.companyLine}>
                Phone: {companySettings.phoneNumber}
              </div>
            )}
            {!isPkList && !isCost && (
              <div className={styles.referenceNumber}>
                {formatEstimateReferenceNumber(estimateCost, generateRandomDigits(8))}
              </div>
            )}
          </div>

          <div className={styles.infoGrid}>
            <InfoRow label="Customer Name" value={estimate.customerName} />
            <InfoRow
              label="Job Name"
              value={estimate.jobName || estimate.dealName}
            />
            <InfoRow label="Job Address" value={estimate.jobAddress} />
            <InfoRow label="Email Address" value={estimate.email} />
            <InfoRow label="Salesperson" value={estimate.salesRep} />
            <InfoRow label="Brand" value={estimate.brand} />
            <InfoRow label="Group / Color" value={estimate.groupColor} />
            <InfoRow label="Removal" value={estimate.removal} />
            <InfoRow label="Project Type" value={estimate.projectType} />
          </div>

          <div className={styles.metaBox}>
            <div className={styles.metaItem}>
              <div className={styles.metaLabel}>Estimate #</div>
              <div className={styles.metaValue}>
                {estimate.estimateNumber || "-"}
                {isPkList ? " PK" : isCost ? " COST" : ""}
              </div>
            </div>
            <div className={styles.metaItem}>
              <div className={styles.metaLabel}>Date</div>
              <div className={styles.metaValue}>
                {new Date(estimate.date).toLocaleDateString()}
              </div>
            </div>
            {estimate.version && (
              <div className={styles.metaItem}>
                <div className={styles.metaLabel}>Version</div>
                <div className={styles.metaValue}>{estimate.version}</div>
              </div>
            )}
          </div>
        </div>

        {isCost && (
          <div className={styles.costBanner}>
            Preco de Custo - internal use only (vendor and installer cost, not customer prices)
          </div>
        )}
        <table className={styles.itemsTable}>
          <colgroup>
            <col className={styles.colQty} />
            <col className={styles.colCode} />
            <col className={styles.colDescription} />
            <col className={styles.colCustomization} />
            <col className={styles.colNote} />
            <col className={styles.colPUnit} />
            <col className={styles.colPTotal} />
          </colgroup>
          <thead>
            <tr>
              <th className={styles.colQty}>Qty</th>
              <th className={styles.colCode}>Code</th>
              <th>Description</th>
              <th className={styles.colCustomization}>Custom</th>
              <th>Note</th>
              <th className={styles.colPUnit}>P.Unit</th>
              <th className={styles.colPTotal}>P.Total</th>
            </tr>
          </thead>
          <tbody>
            {estimate.lineItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#6b7280" }}>
                  No items on this estimate.
                </td>
              </tr>
            ) : (
              estimate.lineItems.map((item: any) => (
                <tr key={item.id}>
                  <td className={styles.colQty}>{toNumber(item.qty)}</td>
                  <td className={styles.colCode}>{item.code || ""}</td>
                  <td>{item.description || ""}</td>
                  <td className={styles.colCustomization}>
                    <span
                      className={styles.customCheckbox}
                      role="img"
                      aria-label={item.isCustomization ? "Custom: yes" : "Custom: no"}
                    >
                      {item.isCustomization ? (
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                          <path
                            d="M2 6.5 L5 9.5 L10 2.5"
                            fill="none"
                            stroke="#111827"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                  </td>
                  <td>{item.note || ""}</td>
                  <td className={styles.colPUnit}>
                    {isCost
                      ? formatCurrency(lineCost(toNumber(item.unitPrice)))
                      : money(toNumber(item.unitPrice))}
                  </td>
                  <td className={styles.colPTotal}>
                    {isCost
                      ? formatCurrency(lineCost(toNumber(item.totalPrice)))
                      : money(toNumber(item.totalPrice))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {estimate.specialCustomizationLines.length > 0 && (
          <div className={styles.specialCustomizationBox}>
            <div className={styles.specialCustomizationTitle}>
              Special Customization
            </div>
            <table className={styles.specialCustomizationTable}>
              <colgroup>
                {Array.from({ length: SPECIAL_CUSTOMIZATION_COLUMNS }).map((_, i) => (
                  <col key={i} className={styles.customizationCol} />
                ))}
              </colgroup>
              <tbody>
                {specialCustomizationRows.map((row, rowIndex) => {
                  const cells = row.map((line: any) => (
                    <td key={line.id} className={styles.customizationCell}>
                      <span className={styles.customizationQty}>
                        {toNumber(line.qty)}
                      </span>{" "}
                      {line.item?.name || ""}
                    </td>
                  ));
                  const padCount = SPECIAL_CUSTOMIZATION_COLUMNS - row.length;
                  for (let i = 0; i < padCount; i += 1) {
                    cells.push(<td key={`pad-${i}`} className={styles.customizationCell} />);
                  }
                  return <tr key={rowIndex}>{cells}</tr>;
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.notesBox}>
            <div className={styles.notesTitle}>Notes</div>
            {estimate.notes || "-"}
          </div>

          <div className={styles.categoryBox}>
            <div className={styles.categoryTitle}>Cabinets Summary</div>
            <div className={styles.categoryRow}>
              <span>Standard Cabinets</span>
              <span>{estimate.standardCabinetsCount}</span>
            </div>
            <div className={styles.categoryRow}>
              <span>Double Cabinets</span>
              <span>{estimate.doubleCabinetsCount}</span>
            </div>
            <div className={styles.categoryRow}>
              <span>Custom Cabinets</span>
              <span>{estimate.customCabinetsCount}</span>
            </div>
            <div className={styles.categoryRow}>
              <span>Miscellaneous</span>
              <span>{estimate.miscCabinetsCount}</span>
            </div>
            <div className={styles.categoryRow}>
              <span>Quantity of Items</span>
              <span>{estimate.itemsQuantity}</span>
            </div>
            <div className={styles.categoryRow}>
              <span>Microwave Installation</span>
              <span>{estimate.microwaveInstallation ? "Yes" : "No"}</span>
            </div>
          </div>

          {isCost ? (
            <div className={styles.totalsBox}>
              <div className={styles.totalsTitle}>Total Summary (cost)</div>
              <div className={styles.totalsRow}>
                <span>Cabinets (cost)</span>
                <strong>{formatCurrency(costSummary.cabinetsCost)}</strong>
              </div>
              <div className={`${styles.totalsRow} ${styles.discount}`}>
                <span>Tax{costTaxPercentLabel > 0 ? ` (${costTaxPercentLabel}%)` : ""}</span>
                <strong>{formatCurrency(costSummary.tax)}</strong>
              </div>
              <div className={`${styles.totalsRow} ${styles.subtotal}`}>
                <span>Cabinets Subtotal</span>
                <strong>{formatCurrency(costSummary.cabinetsSubtotal)}</strong>
              </div>
              <div className={`${styles.totalsRow} ${styles.installation}`}>
                <span>
                  Installation (cost){selectedInstallerName ? ` - ${selectedInstallerName}` : ""}
                  {installerMissingCount > 0 ? " *" : ""}
                </span>
                <strong>{formatCurrency(costSummary.installationCost)}</strong>
              </div>
              <div className={styles.totalsFinal}>
                <span>Total</span>
                <span>{formatCurrency(costSummary.total)}</span>
              </div>
              {installerMissingCount > 0 && (
                <div className={styles.costNote}>
                  * {installerMissingCount} line(s) have no cost for this installer ($0 counted).
                </div>
              )}
            </div>
          ) : (
          <div className={styles.totalsBox}>
            <div className={styles.totalsTitle}>Total Summary</div>
            <div className={styles.totalsRow}>
              <span>Cabinets</span>
              <strong>{money(toNumber(estimate.cabinetsTotal))}</strong>
            </div>
            <div className={`${styles.totalsRow} ${styles.discount}`}>
              <span>
                Discount
                {isPkList ? "" : ` (${discountPercentLabel(discountPercent, discountLabel)})`}
              </span>
              <strong>{money(toNumber(estimate.discount))}</strong>
            </div>
            <div className={`${styles.totalsRow} ${styles.subtotal}`}>
              <span>Cabinets Subtotal</span>
              <strong>{money(toNumber(estimate.cabinetsSubtotal))}</strong>
            </div>
            <div className={`${styles.totalsRow} ${styles.removal}`}>
              <span>Removal</span>
              <strong>{money(toNumber(estimate.removalAmount))}</strong>
            </div>
            <div className={`${styles.totalsRow} ${styles.installation}`}>
              <span>
                Installation
                {!isPkList && estimate.installationTypeName
                  ? ` (${estimate.installationTypeName})`
                  : ""}
              </span>
              <strong>{money(installationTotal)}</strong>
            </div>
            <div className={styles.totalsFinal}>
              <span>Total</span>
              <span>{money(toNumber(estimate.total))}</span>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
