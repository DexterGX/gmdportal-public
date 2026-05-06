import { notFound, redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import BatchAutoPrintClient from "./BatchAutoPrintClient";

type AgreementKey =
  | "payment_term"
  | "cabinet_agreement"
  | "countertop_agreement"
  | "repair_agreement";

const ALLOWED_DOCS: AgreementKey[] = [
  "payment_term",
  "cabinet_agreement",
  "countertop_agreement",
  "repair_agreement",
];

function parseDocs(raw: string | string[] | undefined): AgreementKey[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is AgreementKey =>
      ALLOWED_DOCS.includes(value as AgreementKey),
    );
}

function buildFrameUrl(
  artifactId: string,
  doc: AgreementKey,
  specs: string | string[] | undefined,
) {
  if (doc === "payment_term") {
    return `/payment-term-print/${artifactId}`;
  }

  const params = new URLSearchParams({ key: doc });
  if (
    doc === "countertop_agreement" &&
    typeof specs === "string" &&
    specs.trim()
  ) {
    params.set("specs", specs);
  }

  return `/agreement-print/${artifactId}?${params.toString()}`;
}

export default async function BatchPrintPage({
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
  const docs = parseDocs(query.docs);

  if (docs.length === 0) {
    notFound();
  }

  return (
    <main className="bg-white">
      <BatchAutoPrintClient />
      <div className="mx-auto max-w-[900px] space-y-6 bg-white px-4 py-6 print:max-w-none print:space-y-0 print:px-0 print:py-0">
        {docs.map((doc, index) => (
          <section
            key={`${doc}-${index}`}
            className="rounded-lg border border-gray-200 bg-white print:rounded-none print:border-0"
            style={{ breakAfter: index === docs.length - 1 ? "auto" : "page" }}
          >
            <iframe
              title={doc}
              src={buildFrameUrl(artifactId, doc, query.specs)}
              className="block w-full border-0"
              style={{ height: doc === "payment_term" ? "1520px" : "1280px" }}
            />
          </section>
        ))}
      </div>
    </main>
  );
}
