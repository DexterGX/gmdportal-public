import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import AutoPrintClient from "./AutoPrintClient";
import styles from "./page.module.css";

const prismaAny = prisma as any;

type BreakdownRow = {
  id: string;
  invoiceNumber?: string;
  type?: string;
  total?: number;
  adjustedDeposit?: number;
  adjustedBalance?: number;
};

type TotalsByType = {
  cabinet?: { total?: number; deposit?: number; balance?: number };
  countertop?: { total?: number; deposit?: number; balance?: number };
};

type Meta = {
  paymentTermNumber?: string;
  customerName?: string;
  customerPipedriveId?: string | null;
  customerAddress?: string | null;
  contractor?: string | null;
  dealName?: string | null;
  dealId?: string | null;
  address?: string | null;
  salesRep?: string;
  date?: string;
  revNum?: string;
  totals?: {
    invoiceTotal?: number;
    minimumDeposit?: number;
    clientDeposit?: number;
    remainingBalance?: number;
    byType?: TotalsByType;
  };
  adjustedInvoiceBreakdown?: BreakdownRow[];
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    type: "cabinet" | "countertop";
    amount: number;
  }>;
  lineItemsByInvoice?: Record<
    string,
    Record<
      string,
      {
        amount?: number;
        depositPct?: number;
        noInstallation?: boolean;
      }
    >
  >;
};

type LineKey =
  | "cab_cabinet"
  | "cab_removal"
  | "cab_installation"
  | "cab_others"
  | "ct_slab"
  | "ct_labor"
  | "ct_tile"
  | "ct_reconection"
  | "ct_misc"
  | "svc_repair";

const LINE_KEYS: LineKey[] = [
  "cab_cabinet",
  "cab_removal",
  "cab_installation",
  "cab_others",
  "ct_slab",
  "ct_labor",
  "ct_tile",
  "ct_reconection",
  "ct_misc",
  "svc_repair",
];

const DEFAULT_PCT: Record<LineKey, number> = {
  cab_cabinet: 70,
  cab_removal: 100,
  cab_installation: 100,
  cab_others: 100,
  ct_slab: 100,
  ct_labor: 0,
  ct_tile: 100,
  ct_reconection: 100,
  ct_misc: 100,
  svc_repair: 100,
};

function safeNum(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function clampPct(value: unknown, fallback: number) {
  const n = safeNum(value);
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : fallback));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: number | null | undefined) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function PaymentTermClientPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ artifactId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!["admin", "sales", "office", "finance"].includes(appRole)) {
    redirect("/dashboard");
  }

  const { artifactId } = await params;
  const query = await searchParams;
  const shouldAutoPrint = query.autoprint === "1";

  const artifact = await prisma.jobArtifact.findFirst({
    where: {
      id: artifactId,
      sourceApp: "PAYMENT_TERM",
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  if (!artifact) {
    notFound();
  }

  const meta = ((artifact.metadata ?? {}) as Meta) || {};
  const rows = Array.isArray(meta.adjustedInvoiceBreakdown)
    ? meta.adjustedInvoiceBreakdown
    : [];
  const companySettings = await prismaAny.companyDocumentSettings.findFirst();
  const pageTitle = `${meta.customerName || "Client"} - Payment Term ${meta.paymentTermNumber || ""}`;

  const amountsByKey: Record<LineKey, number> = Object.fromEntries(
    LINE_KEYS.map((key) => [key, 0]),
  ) as Record<LineKey, number>;

  const depositsByKey: Record<LineKey, number> = Object.fromEntries(
    LINE_KEYS.map((key) => [key, 0]),
  ) as Record<LineKey, number>;

  const balancesByKey: Record<LineKey, number> = Object.fromEntries(
    LINE_KEYS.map((key) => [key, 0]),
  ) as Record<LineKey, number>;

  const invoices = Array.isArray(meta.invoices) ? meta.invoices : [];
  const lineItemsByInvoice = meta.lineItemsByInvoice || {};

  for (const invoice of invoices) {
    const invoiceAmount = safeNum(invoice.amount);
    const stateMap = lineItemsByInvoice[invoice.id] || {};

    if (invoice.type === "cabinet") {
      const removal = safeNum(stateMap.cab_removal?.amount);
      const noInstallation = Boolean(stateMap.cab_installation?.noInstallation);
      const installation = noInstallation
        ? 0
        : safeNum(stateMap.cab_installation?.amount);
      const others = safeNum(stateMap.cab_others?.amount);
      const cabinetMain = Math.max(
        0,
        invoiceAmount - (removal + installation + others),
      );

      const cabinetAmounts: Array<[LineKey, number]> = [
        ["cab_cabinet", cabinetMain],
        ["cab_removal", removal],
        ["cab_installation", installation],
        ["cab_others", others],
      ];

      for (const [key, amount] of cabinetAmounts) {
        const pct = clampPct(stateMap[key]?.depositPct, DEFAULT_PCT[key]);
        const deposit = round2((amount * pct) / 100);
        const balance = round2(amount - deposit);
        amountsByKey[key] += amount;
        depositsByKey[key] += deposit;
        balancesByKey[key] += balance;
      }
    }

    if (invoice.type === "countertop") {
      const slab = safeNum(stateMap.ct_slab?.amount);
      const labor = safeNum(stateMap.ct_labor?.amount);
      const tile = safeNum(stateMap.ct_tile?.amount);
      const reconnection = safeNum(stateMap.ct_reconection?.amount);
      const misc = Math.max(
        0,
        invoiceAmount - (slab + labor + tile + reconnection),
      );

      const countertopAmounts: Array<[LineKey, number]> = [
        ["ct_slab", slab],
        ["ct_labor", labor],
        ["ct_tile", tile],
        ["ct_reconection", reconnection],
        ["ct_misc", misc],
      ];

      for (const [key, amount] of countertopAmounts) {
        const pct = clampPct(stateMap[key]?.depositPct, DEFAULT_PCT[key]);
        const deposit = round2((amount * pct) / 100);
        const balance = round2(amount - deposit);
        amountsByKey[key] += amount;
        depositsByKey[key] += deposit;
        balancesByKey[key] += balance;
      }
    }
  }

  const depositBullets = [
    {
      label: "Deposit of cabinet invoice amount",
      amount: depositsByKey.cab_cabinet,
    },
    {
      label: "Deposit of removal/installation/others amount",
      amount:
        depositsByKey.cab_removal +
        depositsByKey.cab_installation +
        depositsByKey.cab_others,
    },
    {
      label: "Deposit of countertop invoice amount",
      amount:
        depositsByKey.ct_slab + depositsByKey.ct_misc + depositsByKey.ct_labor,
    },
    {
      label: "Deposit of reconnection amount",
      amount: depositsByKey.ct_reconection,
    },
    {
      label: "Deposit of tile backsplash amount",
      amount: depositsByKey.ct_tile,
    },
    {
      label: "Deposit of repair amount",
      amount: depositsByKey.svc_repair,
    },
  ].filter((entry) => Math.abs(entry.amount) > 0.004);

  const minimumDeposit = round2(
    Object.values(depositsByKey).reduce((a, b) => a + b, 0),
  );
  const clientDeposit = safeNum(meta.totals?.clientDeposit);
  let surplus = round2(Math.max(0, clientDeposit - minimumDeposit));

  function applyCredit(balance: number, credit: number): [number, number] {
    const applied = Math.min(balance, credit);
    return [round2(balance - applied), round2(credit - applied)];
  }

  let adjDelivery = balancesByKey.cab_cabinet;
  let adjCabInstall =
    balancesByKey.cab_removal +
    balancesByKey.cab_installation +
    balancesByKey.cab_others;
  let adjCountertop = balancesByKey.ct_labor + balancesByKey.ct_misc;
  let adjBacksplash = balancesByKey.ct_tile;
  let adjReconnection = balancesByKey.ct_reconection;
  let adjRepair = balancesByKey.svc_repair;

  [adjDelivery, surplus] = applyCredit(adjDelivery, surplus);
  [adjCabInstall, surplus] = applyCredit(adjCabInstall, surplus);
  [adjCountertop, surplus] = applyCredit(adjCountertop, surplus);
  [adjBacksplash, surplus] = applyCredit(adjBacksplash, surplus);
  [adjReconnection, surplus] = applyCredit(adjReconnection, surplus);
  [adjRepair, surplus] = applyCredit(adjRepair, surplus);

  const balanceColumns = {
    clientDeposit,
    deliveryCabinetBalance: adjDelivery,
    cabinetInstallRemovalOthers: adjCabInstall,
    countertopInstall: adjCountertop,
    reconnection: adjReconnection,
    backsplashAndReconnection: adjBacksplash,
    repair: adjRepair,
    total: safeNum(meta.totals?.invoiceTotal),
  };

  return (
    <div className={styles.screen}>
      {shouldAutoPrint && <AutoPrintClient title={pageTitle} />}
      <div className={styles.sheet}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <img
              src={companySettings?.logoUrl || "/logo.svg"}
              alt={companySettings?.companyName || "GM Design"}
              className={styles.logo}
            />
            <div className={styles.companyInfo}>
              <div className={styles.name}>
                {companySettings?.companyName || "GM Design"}
              </div>
              {companySettings?.phoneNumber && (
                <div className={styles.contactRow}>
                  <Phone className={styles.contactIcon} />
                  <span>{companySettings.phoneNumber}</span>
                </div>
              )}
              {companySettings?.email && (
                <div className={styles.contactRow}>
                  <Mail className={styles.contactIcon} />
                  <span>{companySettings.email}</span>
                </div>
              )}
              {companySettings?.website && (
                <div className={styles.contactRow}>
                  <Globe className={styles.contactIcon} />
                  <span>{companySettings.website}</span>
                </div>
              )}
              {companySettings?.address && (
                <div className={styles.contactRow}>
                  <MapPin className={styles.contactIcon} />
                  <span>{companySettings.address}</span>
                </div>
              )}
            </div>
          </div>
          <div className={styles.rev}>
            <div className={styles.revRow}>
              <div className={styles.revLabel}>TERM #</div>
              <div className={styles.revValue}>
                {meta.paymentTermNumber || "-"}
              </div>
            </div>
            <div className={styles.revRow}>
              <div className={styles.revLabel}>REVISION #</div>
              <div className={styles.revValue}>{meta.revNum || "1"}</div>
            </div>
          </div>
        </header>

        <section className={styles.block}>
          <div className={styles.grid}>
            <div>
              <span>Client:</span> {meta.customerName || "-"}
            </div>
            <div>
              <span>Pipedrive ID:</span> {meta.customerPipedriveId || "-"}
            </div>
            <div>
              <span>Job/Deal:</span> {meta.dealName || "-"}
            </div>
            <div>
              <span>Job ID:</span> {meta.dealId || "-"}
            </div>
            <div>
              <span>Address:</span>{" "}
              {meta.customerAddress || meta.address || "-"}
            </div>
            <div>
              <span>Sales Rep:</span> {meta.salesRep || "-"}
            </div>
            <div>
              <span>Contractor:</span> {meta.contractor || "-"}
            </div>
            <div>
              <span>Date:</span> {meta.date || "-"}
            </div>
          </div>
        </section>

        <h1 className={styles.title}>PAYMENT TERM</h1>

        <section className={styles.block}>
          <div className={styles.row}>
            <span>Invoice(s) Amount:</span>
            <strong>${money(meta.totals?.invoiceTotal)}</strong>
          </div>
        </section>

        <section className={styles.block}>
          <h2>DEPOSIT BREAKDOWN</h2>
          {depositBullets.length === 0 ? (
            <div className={styles.emptyCharges}>
              No deposit charge lines for this payment term.
            </div>
          ) : (
            <ul className={styles.chargesList}>
              {depositBullets.map((entry) => (
                <li key={entry.label}>
                  {entry.label}: <strong>${money(entry.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.row}>
            <span>Minimum Deposit Amount:</span>
            <strong>${money(meta.totals?.minimumDeposit)}</strong>
          </div>
        </section>

        <section className={styles.block}>
          <h2>BALANCE DISTRIBUTION (BALANCE PAID UPON COMPLETION)</h2>
          <table className={styles.balanceTable}>
            <colgroup>
              <col style={{ width: "12.5%" }} />
              <col style={{ width: "12.5%" }} />
              <col style={{ width: "12.5%" }} />
              <col style={{ width: "12.5%" }} />
              <col style={{ width: "12.5%" }} />
              <col style={{ width: "12.5%" }} />
              <col style={{ width: "12.5%" }} />
              <col style={{ width: "12.5%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Client Deposit Given</th>
                <th>Delivery (Cabinet Balance)</th>
                <th>Cab. Install / Removal / Others</th>
                <th>Countertop Install</th>
                <th>Reconnection</th>
                <th>Tile Backsplash Installation</th>
                <th>Repair</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  {balanceColumns.clientDeposit !== 0
                    ? `$${money(balanceColumns.clientDeposit)}`
                    : ""}
                </td>
                <td>
                  {balanceColumns.deliveryCabinetBalance !== 0
                    ? `$${money(balanceColumns.deliveryCabinetBalance)}`
                    : ""}
                </td>
                <td>
                  {balanceColumns.cabinetInstallRemovalOthers !== 0
                    ? `$${money(balanceColumns.cabinetInstallRemovalOthers)}`
                    : ""}
                </td>
                <td>
                  {balanceColumns.countertopInstall !== 0
                    ? `$${money(balanceColumns.countertopInstall)}`
                    : ""}
                </td>
                <td>
                  {balanceColumns.reconnection !== 0
                    ? `$${money(balanceColumns.reconnection)}`
                    : ""}
                </td>
                <td>
                  {balanceColumns.backsplashAndReconnection !== 0
                    ? `$${money(balanceColumns.backsplashAndReconnection)}`
                    : ""}
                </td>
                <td>
                  {balanceColumns.repair !== 0
                    ? `$${money(balanceColumns.repair)}`
                    : ""}
                </td>
                <td>
                  {balanceColumns.total !== 0
                    ? `$${money(balanceColumns.total)}`
                    : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {rows.length > 0 && (
          <section className={styles.block}>
            <h2>Invoice Breakdown</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Deposit</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id || String(index)}>
                    <td>{row.invoiceNumber || `Invoice ${index + 1}`}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {row.type || "-"}
                    </td>
                    <td>${money(row.total)}</td>
                    <td>${money(row.adjustedDeposit)}</td>
                    <td>${money(row.adjustedBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div className={styles.pageBottom}>
          <footer className={styles.signatures}>
            <div>Client Signature</div>
            <div>Date</div>
          </footer>

          <div className={styles.termsBox}>
            <p>
              ■ 70% Deposit of cabinet and accessories amount. Balance due on
              cabinet delivery date. ■ 50% deposit of cabinet removal and/or
              cabinet installations. Balance due on cabinet installation date. ■
              50% deposit of counter top invoice. Balance due on counter top
              installation date completion. * If slab price is higher than labor
              price, client needs to pay as a deposit the full amount of slabs
              plus 50% of labor amount. Balance due on counter top installation
              date. ■ 50% deposit of tile backsplash and/or installation.
              Balance due on tile installation date completion. ■ 50% deposit of
              reconnection amount. Balance due on completion date. ■ 50% deposit
              of repair service amount. Balance due on completion date.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
