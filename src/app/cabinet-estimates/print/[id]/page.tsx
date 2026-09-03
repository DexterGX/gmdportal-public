import { notFound, redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import {
  computeInstallationTotal,
  computeLineItemsCustomizationSurchargeTotal,
  discountPercentLabel,
  formatCurrency,
} from "@/lib/cabinetEstimateCalc";
import AutoPrintClient from "./AutoPrintClient";
import PrintButton from "./PrintButton";
import styles from "./page.module.css";

const prismaAny = prisma as any;

const VIEW_ROLES = ["admin", "sales", "office", "finance"];

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
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }
  if (!VIEW_ROLES.includes(appRole)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const query = await searchParams;
  const shouldAutoPrint = query.autoprint === "1";

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

  const pageTitle = `${estimate.customerName || "Client"} - Cabinet Estimate ${
    estimate.estimateNumber || ""
  }`;
  const printedOn = new Date().toLocaleString("en-US");
  const printedBy = user.name || user.email || "Unknown";
  const discountPercent = toNumber(estimate.discountPercent);
  const specialCustomizationRows = chunkArray(
    estimate.specialCustomizationLines,
    SPECIAL_CUSTOMIZATION_COLUMNS,
  );
  const lineCustomizationSurchargeAmount = computeLineItemsCustomizationSurchargeTotal(
    estimate.lineItems.map((item: any) => ({
      qty: toNumber(item.qty),
      unitPrice: toNumber(item.unitPrice),
      isCustomization: Boolean(item.isCustomization),
      customizationType:
        item.customizationType === "percent" || item.customizationType === "flat"
          ? item.customizationType
          : null,
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
        <PrintButton />
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
              <th>Code</th>
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
                  <td>{item.code || ""}</td>
                  <td>{item.description || ""}</td>
                  <td className={styles.colCustomization}>
                    {item.isCustomization && item.customizationType === "flat"
                      ? formatCurrency(toNumber(item.customizationValue))
                      : item.isCustomization && item.customizationType === "percent"
                        ? `${toNumber(item.customizationValue)}%`
                        : item.isCustomization
                          ? "Yes"
                          : ""}
                  </td>
                  <td>{item.note || ""}</td>
                  <td className={styles.colPUnit}>
                    {formatCurrency(toNumber(item.unitPrice))}
                  </td>
                  <td className={styles.colPTotal}>
                    {formatCurrency(toNumber(item.totalPrice))}
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

          <div className={styles.totalsBox}>
            <div className={styles.totalsTitle}>Total Summary</div>
            <div className={styles.totalsRow}>
              <span>Cabinets</span>
              <strong>{formatCurrency(toNumber(estimate.cabinetsTotal))}</strong>
            </div>
            <div className={`${styles.totalsRow} ${styles.discount}`}>
              <span>Discount ({discountPercentLabel(discountPercent)})</span>
              <strong>{formatCurrency(toNumber(estimate.discount))}</strong>
            </div>
            <div className={`${styles.totalsRow} ${styles.subtotal}`}>
              <span>Cabinets Subtotal</span>
              <strong>
                {formatCurrency(toNumber(estimate.cabinetsSubtotal))}
              </strong>
            </div>
            <div className={`${styles.totalsRow} ${styles.removal}`}>
              <span>Removal</span>
              <strong>{formatCurrency(toNumber(estimate.removalAmount))}</strong>
            </div>
            <div className={`${styles.totalsRow} ${styles.installation}`}>
              <span>Installation</span>
              <strong>{formatCurrency(installationTotal)}</strong>
            </div>
            <div className={styles.totalsFinal}>
              <span>Total</span>
              <span>{formatCurrency(toNumber(estimate.total))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
