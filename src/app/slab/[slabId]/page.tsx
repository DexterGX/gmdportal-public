import postgres from "postgres";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL || "", {
  ssl: "require",
});

type SlabRow = {
  id: string;
  scannerId: string;
  name: string;
  type: string;
  thickness: string;
  size: string;
  clientName: string;
  brand: string | null;
  finish: string | null;
  notes: string | null;
  jobId: string | null;
  rackId: string;
  createdAt: Date;
};

async function getSlab(slabId: string): Promise<SlabRow | null> {
  const rows = await sql<SlabRow[]>`
    SELECT * FROM "SlabBaySlab" WHERE "id" = ${slabId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slabId: string }>;
}): Promise<Metadata> {
  const { slabId } = await params;
  const slab = await getSlab(slabId);
  return {
    title: slab ? `${slab.name} | GMD Portal` : "Slab Not Found | GMD Portal",
  };
}

const TYPE_LABEL: Record<string, string> = {
  SLAB: "Slab",
  GMD: "GMD",
  REMNANT: "Remnant",
  RESERVED: "Reserved",
  CLIENT_SLAB: "Client Slab",
};

export default async function SlabPublicPage({
  params,
}: {
  params: Promise<{ slabId: string }>;
}) {
  const { slabId } = await params;
  const slab = await getSlab(slabId);

  if (!slab) notFound();

  const sepIdx = slab.clientName.indexOf("||");
  const displayClient =
    sepIdx !== -1 ? slab.clientName.slice(0, sepIdx) : slab.clientName;
  const originalClient =
    sepIdx !== -1 ? slab.clientName.slice(sepIdx + 2) : null;

  const createdAt = new Date(slab.createdAt);
  const dateStr = Number.isNaN(createdAt.getTime())
    ? "-"
    : createdAt.toLocaleDateString();

  const fields: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Scanner ID", value: slab.scannerId },
    { label: "Slab Name", value: slab.name },
    { label: "Provider", value: slab.brand || "-" },
    { label: "Finish", value: slab.finish || "-" },
    { label: "Thickness", value: slab.thickness },
    { label: "Size", value: slab.size },
    { label: "Client", value: displayClient || "-" },
    ...(originalClient
      ? [{ label: "Original Client", value: originalClient }]
      : []),
    { label: "Slab Type", value: TYPE_LABEL[slab.type] ?? slab.type },
    { label: "Job ID", value: slab.jobId || "-" },
    { label: "Notes", value: slab.notes || "-" },
    { label: "Rack", value: slab.rackId.toUpperCase() },
    { label: "Date Added", value: dateStr },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 mb-4">
            <svg
              className="w-7 h-7 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{slab.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {TYPE_LABEL[slab.type] ?? slab.type} &middot; Rack{" "}
            {slab.rackId.toUpperCase()}
          </p>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <dl className="divide-y divide-gray-100">
            {fields.map(({ label, value }) => (
              <div key={label} className="flex items-start gap-4 px-5 py-3.5">
                <dt className="w-36 shrink-0 text-sm font-medium text-gray-500">
                  {label}
                </dt>
                <dd className="flex-1 text-sm text-gray-900 break-words">
                  {value || "-"}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          GMD Portal &middot; Slab Rack System
        </p>
      </div>
    </div>
  );
}
