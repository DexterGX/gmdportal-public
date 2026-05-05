import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  Hash,
  Package,
  ScrollText,
} from "lucide-react";

function fmtCurrency(v: number | null): string {
  if (v === null || v === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(v);
}

function fmtDate(d: string | Date | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const jobStatusColors: Record<string, string> = {
  ONGOING: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  COMPLETE:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  ON_HOLD:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
};

const accessoryStatusColors: Record<string, string> = {
  READY_TO_ORDER:
    "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
  ORDERED: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  PARTIALLY_RECEIVED:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  RECEIVED:
    "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  INSTALLED: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

const promoStatusColors: Record<string, string> = {
  AVAILABLE:
    "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  ON_HOLD:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  SOLD: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

type LinkedPromotionalSlab = {
  id: string;
  slabBaySlabId: string;
  status: string;
  price: unknown;
  isPriceTbd: boolean | null;
  holdUntil: Date | string | null;
  updatedAt: Date | string | null;
  name: string | null;
  type: string | null;
  thickness: string | null;
  size: string | null;
  rackId: string | null;
};

export default async function CustomerV2JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; jobId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, jobId } = await params;
  const query = await searchParams;

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      customerId: id,
    },
    include: {
      customer: {
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
        },
      },
      artifacts: {
        orderBy: { createdAt: "desc" },
      },
      accessoryTrackers: {
        where: { isArchived: false },
        orderBy: { updatedAt: "desc" },
        include: {
          items: {
            where: { isArchived: false },
            orderBy: { updatedAt: "desc" },
          },
        },
      },
      sampleRequests: {
        orderBy: { createdAt: "desc" },
      },
      closetJob: {
        include: {
          quotes: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              quoteCode: true,
              status: true,
              finalPrice: true,
            },
          },
        },
      },
    },
  });

  if (!job) {
    notFound();
  }

  const qs = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (typeof value === "string") qs.set(key, value);
  });

  const backHref = qs.toString()
    ? `/customers-v2/${id}?${qs.toString()}#job-${job.id}`
    : `/customers-v2/${id}#job-${job.id}`;
  const selectedArtifactId =
    typeof query.artifactId === "string" ? query.artifactId : null;

  const visibleArtifacts = job.artifacts.filter((artifact) => {
    if (artifact.sourceApp !== "PAYMENT_TERM") {
      return true;
    }

    const meta =
      artifact.metadata && typeof artifact.metadata === "object"
        ? (artifact.metadata as Record<string, unknown>)
        : {};

    return meta.showInCustomerFiles === true;
  });

  const totalAccessories = job.accessoryTrackers.reduce(
    (sum, tracker) => sum + tracker.items.length,
    0,
  );

  const serializedQuotes = (job.closetJob?.quotes ?? []).map((q) => ({
    ...q,
    finalPrice: (q.finalPrice as any)?.toNumber?.() ?? 0,
  }));

  let linkedPromotionalSlabs: LinkedPromotionalSlab[] = [];
  try {
    const rows = await prisma.$queryRawUnsafe<LinkedPromotionalSlab[]>(
      `
      SELECT
        ps."id",
        ps."slabBaySlabId",
        ps."status",
        ps."price",
        ps."isPriceTbd",
        ps."holdUntil",
        ps."updatedAt",
        sb."name",
        sb."type",
        sb."thickness",
        sb."size",
        sb."rackId"
      FROM "PromotionalSlab" ps
      LEFT JOIN "SlabBaySlab" sb ON sb."id" = ps."slabBaySlabId"
      WHERE
        (ps."holdCustomerId" = $1 AND ps."holdJobId" = $2)
        OR
        (ps."soldCustomerId" = $1 AND ps."soldJobId" = $2)
      ORDER BY ps."updatedAt" DESC
      `,
      id,
      jobId,
    );
    linkedPromotionalSlabs = Array.isArray(rows) ? rows : [];
  } catch {
    linkedPromotionalSlabs = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {job.jobName}
            </h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/30 px-2 py-0.5 rounded">
                <Hash className="w-3 h-3" />
                {job.jobNumber}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  jobStatusColors[job.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {job.status === "COMPLETE"
                  ? "SOLD"
                  : job.status.replace("_", " ")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="text-center px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {totalAccessories}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Accessory Items
            </p>
          </div>
          <div className="text-center px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {job.sampleRequests.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sample Requests
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Briefcase className="w-4 h-4" />
          Job + Client
        </h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Client</p>
            <Link
              href={`/customers-v2/${job.customer.id}`}
              className="text-teal-600 dark:text-teal-400 hover:underline font-medium"
            >
              {job.customer.displayName}
            </Link>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Job Value</p>
            <p className="text-gray-900 dark:text-gray-100 font-medium">
              {fmtCurrency((job.value as any)?.toNumber?.() ?? null)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Created</p>
            <p className="text-gray-900 dark:text-gray-100">
              {fmtDate(job.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Updated</p>
            <p className="text-gray-900 dark:text-gray-100">
              {fmtDate(job.updatedAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Associated Items
          </h2>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Accessory Trackers / Items
            </h3>
            {job.accessoryTrackers.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No accessory items linked to this job yet.
              </p>
            )}
            {job.accessoryTrackers.length > 0 && (
              <div className="space-y-4">
                {job.accessoryTrackers.map((tracker) => (
                  <div
                    key={tracker.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Tracker{" "}
                        {tracker.invoiceNumber
                          ? `- Invoice ${tracker.invoiceNumber}`
                          : ""}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {tracker.items.length} item
                        {tracker.items.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {tracker.items.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {tracker.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900/40 rounded px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Qty {item.quantity}
                                {item.vendor ? ` | ${item.vendor}` : ""}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                accessoryStatusColors[item.status] ??
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {item.status.replace(/_/g, " ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Promotional Slabs (On Hold / Sold)
            </h3>
            {linkedPromotionalSlabs.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No promotional slabs linked to this job yet.
              </p>
            )}
            {linkedPromotionalSlabs.length > 0 && (
              <div className="space-y-2">
                {linkedPromotionalSlabs.map((slab) => {
                  const priceNum =
                    (slab.price as any)?.toNumber?.() ??
                    Number(slab.price ?? 0);
                  return (
                    <div
                      key={slab.id}
                      className="flex items-start justify-between gap-2 bg-gray-50 dark:bg-gray-900/40 rounded px-3 py-2"
                    >
                      <div>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          <a
                            href={`/slab/${encodeURIComponent(slab.slabBaySlabId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            {slab.name || "Unnamed slab"} ({slab.slabBaySlabId})
                          </a>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(slab.type ?? "-") +
                            " | " +
                            (slab.thickness ?? "-") +
                            " | " +
                            (slab.size ?? "-")}
                          {slab.rackId ? ` | Rack ${slab.rackId}` : ""}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Price:{" "}
                          {slab.isPriceTbd ? "TBD" : fmtCurrency(priceNum)}
                          {slab.status === "ON_HOLD"
                            ? ` | Release: ${fmtDate(slab.holdUntil)}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            promoStatusColors[slab.status] ??
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {slab.status.replace(/_/g, " ")}
                        </span>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Updated {fmtDate(slab.updatedAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Sample Requests
            </h3>
            {job.sampleRequests.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No sample requests linked to this job yet.
              </p>
            )}
            {job.sampleRequests.length > 0 && (
              <div className="space-y-2">
                {job.sampleRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900/40 rounded px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {request.brand} - {request.colorName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {request.sampleType} | Qty {request.quantity}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {request.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6" id="job-artifacts">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Job Artifacts
            </h3>
            {visibleArtifacts.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No artifacts attached to this job yet.
              </p>
            )}
            {visibleArtifacts.length > 0 && (
              <div className="space-y-2">
                {visibleArtifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className={`flex items-center justify-between gap-2 rounded px-3 py-2 ${
                      selectedArtifactId === artifact.id
                        ? "bg-teal-50 dark:bg-teal-900/20 ring-1 ring-teal-400"
                        : "bg-gray-50 dark:bg-gray-900/40"
                    }`}
                  >
                    <div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {artifact.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {artifact.sourceApp} | {artifact.type} |{" "}
                        {fmtDate(artifact.createdAt)}
                      </p>
                    </div>
                    {artifact.url ? (
                      <a
                        href={artifact.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        Open
                      </a>
                    ) : artifact.sourceApp === "MISC_ESTIMATE" ? (
                      <a
                        href={`/misc-estimate-print/${encodeURIComponent(artifact.id)}?autoprint=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        Download Estimate
                      </a>
                    ) : artifact.sourceApp === "PAYMENT_TERM" ? (
                      <a
                        href={`/payment-term-print/${encodeURIComponent(artifact.id)}?autoprint=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        Open Payment Term
                      </a>
                    ) : (
                      <FileText className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {job.closetJob && (
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Closet Job Quotes
              </h3>
              <Link
                href={`/closet-jobs/${job.closetJob.id}`}
                className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
              >
                {job.closetJob.quoteNumber} ({job.closetJob.status})
              </Link>
              {serializedQuotes.length > 0 && (
                <div className="mt-3 space-y-2">
                  {serializedQuotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900/40 rounded px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <ScrollText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {quote.quoteCode}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {quote.status}
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {fmtCurrency(quote.finalPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {job.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Notes
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {job.notes}
          </p>
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        Last update: {fmtDate(job.updatedAt)}
      </div>
    </div>
  );
}
