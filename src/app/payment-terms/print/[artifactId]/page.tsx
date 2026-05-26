import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import AutoPrintClient from "./AutoPrintClient";

const prismaAny = prisma as any;

type Invoice = {
  id: string;
  num: string;
  amount: string;
  type: "cabinet" | "countertop" | "refinish-reface";
};

type BreakdownRow = {
  id: string;
  invoiceNumber?: string;
  type?: string;
  total?: number;
  adjustedDeposit?: number;
  adjustedBalance?: number;
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
  invoices?: Invoice[];
  totals?: {
    invoiceTotal?: number;
    minimumDeposit?: number;
    clientDeposit?: number;
    remainingBalance?: number;
    byType?: {
      cabinet?: { total?: number; deposit?: number; balance?: number };
      countertop?: { total?: number; deposit?: number; balance?: number };
      "refinish-reface"?: {
        total?: number;
        deposit?: number;
        balance?: number;
      };
    };
  };
  adjustedInvoiceBreakdown?: BreakdownRow[];
};

function money(value: number | null | undefined) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function PaymentTermCurrentPrintPage({
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
  const companySettings = await prismaAny.companyDocumentSettings.findFirst();
  const invoices = Array.isArray(meta.invoices) ? meta.invoices : [];
  const rows = Array.isArray(meta.adjustedInvoiceBreakdown)
    ? meta.adjustedInvoiceBreakdown
    : [];

  const title = `${meta.customerName || "Client"} - Payment Term ${meta.paymentTermNumber || ""}`;

  return (
    <div className="bg-gray-100 min-h-screen p-6 print:bg-white print:p-0">
      {shouldAutoPrint && <AutoPrintClient title={title} />}
      <div className="mx-auto max-w-[900px] rounded-xl border border-gray-300 bg-white p-6 print:rounded-none print:border print:border-black print:max-w-none print:p-4">
        <header className="grid grid-cols-3 gap-4 border-b border-black pb-4">
          <div className="col-span-2">
            <img
              src={companySettings?.logoUrl || "/logo.svg"}
              alt={companySettings?.companyName || "GM Design"}
              className="h-16 object-contain"
            />
            <p className="mt-2 text-sm font-semibold">
              {companySettings?.companyName || "GM Design"}
            </p>
            <p className="text-xs">{companySettings?.phoneNumber || "-"}</p>
            <p className="text-xs">{companySettings?.address || "-"}</p>
          </div>
          <div className="border border-black p-2 text-center">
            <p className="text-[10px] uppercase tracking-wide">Revision #</p>
            <p className="text-lg font-bold">{meta.revNum || "1"}</p>
            <p className="mt-2 text-[10px] uppercase tracking-wide">
              Payment Term #
            </p>
            <p className="text-sm font-bold">{meta.paymentTermNumber || "-"}</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-1 border border-black p-2">
            <p>
              <span className="font-semibold">Client:</span>{" "}
              {meta.customerName || "-"}
            </p>
            <p>
              <span className="font-semibold">PD ID:</span>{" "}
              {meta.customerPipedriveId || "-"}
            </p>
            <p>
              <span className="font-semibold">Contractor:</span>{" "}
              {meta.contractor || "-"}
            </p>
            <p>
              <span className="font-semibold">Address:</span>{" "}
              {meta.customerAddress || meta.address || "-"}
            </p>
          </div>
          <div className="space-y-1 border border-black p-2">
            <p>
              <span className="font-semibold">Deal:</span>{" "}
              {meta.dealName || "-"}
            </p>
            <p>
              <span className="font-semibold">Deal ID:</span>{" "}
              {meta.dealId || "-"}
            </p>
            <p>
              <span className="font-semibold">Sales Rep:</span>{" "}
              {meta.salesRep || "-"}
            </p>
            <p>
              <span className="font-semibold">Date:</span> {meta.date || "-"}
            </p>
          </div>
        </section>

        <section className="mt-4 border border-black">
          <div className="grid grid-cols-4 bg-gray-100 border-b border-black text-[11px] font-semibold">
            <div className="p-2 border-r border-black">Invoice #</div>
            <div className="p-2 border-r border-black">Type</div>
            <div className="p-2 border-r border-black text-right">Amount</div>
            <div className="p-2 text-right">Deposits/Balances</div>
          </div>
          {invoices.map((inv) => {
            const match = rows.find((r) => r.id === inv.id);
            return (
              <div
                key={inv.id}
                className="grid grid-cols-4 text-[11px] border-b border-black last:border-b-0"
              >
                <div className="p-2 border-r border-black">
                  {inv.num || "-"}
                </div>
                <div className="p-2 border-r border-black capitalize">
                  {inv.type}
                </div>
                <div className="p-2 border-r border-black text-right">
                  ${money(Number(String(inv.amount).replace(/[^0-9.-]/g, "")))}
                </div>
                <div className="p-2 text-right">
                  D ${money(match?.adjustedDeposit)} / B $
                  {money(match?.adjustedBalance)}
                </div>
              </div>
            );
          })}
        </section>

        <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="border border-black p-3 space-y-2">
            <p className="font-semibold">Distribution Summary</p>
            <div className="flex justify-between">
              <span>Cabinet Total</span>
              <span>${money(meta.totals?.byType?.cabinet?.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Countertop Total</span>
              <span>${money(meta.totals?.byType?.countertop?.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Refinish / Reface Total</span>
              <span>
                ${money(meta.totals?.byType?.["refinish-reface"]?.total)}
              </span>
            </div>
            <div className="flex justify-between border-t border-black pt-2 font-semibold">
              <span>Total Invoice(s) Amount</span>
              <span>${money(meta.totals?.invoiceTotal)}</span>
            </div>
          </div>
          <div className="border border-black p-3 space-y-2">
            <p className="font-semibold">Payment Terms</p>
            <div className="flex justify-between">
              <span>Minimum Deposit</span>
              <span>${money(meta.totals?.minimumDeposit)}</span>
            </div>
            <div className="flex justify-between">
              <span>Client Deposit</span>
              <span>${money(meta.totals?.clientDeposit)}</span>
            </div>
            <div className="flex justify-between border-t border-black pt-2 font-semibold">
              <span>Remaining Balance</span>
              <span>${money(meta.totals?.remainingBalance)}</span>
            </div>
          </div>
        </section>

        <footer className="mt-8 grid grid-cols-2 gap-8 text-xs">
          <div className="pt-8 border-t border-black text-center">
            Client Signature
          </div>
          <div className="pt-8 border-t border-black text-center">Date</div>
        </footer>
      </div>
    </div>
  );
}
