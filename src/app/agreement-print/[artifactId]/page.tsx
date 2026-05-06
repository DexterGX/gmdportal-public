import { notFound, redirect } from "next/navigation";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import AutoPrintClient from "../../payment-term-print/[artifactId]/AutoPrintClient";
import styles from "./page.module.css";

type AgreementKey =
  | "cabinet_agreement"
  | "countertop_agreement"
  | "repair_agreement";

type CountertopAgreementSpec = {
  id?: string;
  title?: string;
  sinkSelection?: string;
  gmdSinkType?: string;
  fabricatedSinkStyle?: string;
  kitchenBathroomModel?: string;
  edgeThickness?: string;
  edgeProfile?: string;
};

type Meta = {
  customerName?: string;
  dealName?: string | null;
  invoices?: Array<{
    id?: string;
    invoiceNumber?: string;
    num?: string;
  }>;
};

const prismaAny = prisma as any;

const AGREEMENT_TITLES: Record<AgreementKey, string> = {
  cabinet_agreement: "Cabinet Agreement",
  countertop_agreement: "Countertop Agreement",
  repair_agreement: "Repair Agreement",
};

function parseSpecs(
  raw: string | string[] | undefined,
): CountertopAgreementSpec[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatEnumValue(value: string | undefined) {
  if (!value) return "";
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function splitAgreementParagraphs(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n");
  return normalized
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default async function AgreementPrintPage({
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
  const agreementKey = query.key;
  const shouldAutoPrint = query.autoprint === "1";

  if (
    agreementKey !== "cabinet_agreement" &&
    agreementKey !== "countertop_agreement" &&
    agreementKey !== "repair_agreement"
  ) {
    notFound();
  }

  const [artifact, template, companySettings] = await Promise.all([
    prisma.jobArtifact.findFirst({
      where: {
        id: artifactId,
        sourceApp: "PAYMENT_TERM",
      },
      select: {
        id: true,
        metadata: true,
      },
    }),
    prismaAny.agreementFormTemplate.findUnique({
      where: { key: agreementKey },
      select: {
        title: true,
        content: true,
      },
    }),
    prismaAny.companyDocumentSettings.findFirst(),
  ]);

  if (!artifact || !template) {
    notFound();
  }

  const meta = ((artifact.metadata ?? {}) as Meta) || {};
  const title = template.title?.trim() || AGREEMENT_TITLES[agreementKey];
  const pageTitle = `${meta.customerName || "Client"} - ${title}`;
  const paragraphs = splitAgreementParagraphs(template.content?.trim() || "");
  const invoiceNumbers = Array.isArray(meta.invoices)
    ? meta.invoices
        .map((invoice) =>
          String(invoice.invoiceNumber || invoice.num || "").trim(),
        )
        .filter(Boolean)
    : [];
  const countertopSpecs =
    agreementKey === "countertop_agreement" ? parseSpecs(query.specs) : [];
  const companyPhone =
    companySettings?.companyPhone || companySettings?.phoneNumber || "";
  const companyEmail =
    companySettings?.companyEmail || companySettings?.email || "";
  const companyWebsite =
    companySettings?.companyWebsite || companySettings?.website || "";
  const companyAddress =
    companySettings?.companyAddress || companySettings?.address || "";

  return (
    <main className={styles.screen}>
      {shouldAutoPrint ? <AutoPrintClient title={pageTitle} /> : null}

      <div className={styles.sheet}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <img
              src={companySettings?.logoUrl || "/logo.svg"}
              alt={companySettings?.companyName || "GM Design"}
              className={styles.logo}
            />

            <div className={styles.companyInfo}>
              <div className={styles.companyName}>
                {companySettings?.companyName || "GM Design"}
              </div>
              {companyPhone ? (
                <div className={styles.contactRow}>
                  <Phone className={styles.contactIcon} />
                  <span>{companyPhone}</span>
                </div>
              ) : null}
              {companyEmail ? (
                <div className={styles.contactRow}>
                  <Mail className={styles.contactIcon} />
                  <span>{companyEmail}</span>
                </div>
              ) : null}
              {companyWebsite ? (
                <div className={styles.contactRow}>
                  <Globe className={styles.contactIcon} />
                  <span>{companyWebsite}</span>
                </div>
              ) : null}
              {companyAddress ? (
                <div className={styles.contactRow}>
                  <MapPin className={styles.contactIcon} />
                  <span>{companyAddress}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.clientBlock}>
            <div>
              <span>Client:</span> {meta.customerName || "-"}
            </div>
            <div>
              <span>Job:</span> {meta.dealName || "-"}
            </div>
            <div>
              <span>Invoice #:</span>{" "}
              {invoiceNumbers.length > 0 ? invoiceNumbers.join(", ") : "-"}
            </div>
          </div>
        </header>

        <h1 className={styles.centeredTitle}>{title}</h1>

        <section className={styles.contentBlock}>
          <div className={styles.legalColumnsGrid}>
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => (
                <p
                  key={`${agreementKey}-paragraph-${index}`}
                  className={styles.legalParagraph}
                >
                  {paragraph}
                </p>
              ))
            ) : (
              <p
                className={styles.legalParagraph}
              >{`${title} content has not been configured yet.`}</p>
            )}
          </div>
        </section>

        {countertopSpecs.length > 0 ? (
          <section className={styles.specsBlock}>
            <h2>Countertop Specifications</h2>
            <div className={styles.specsList}>
              {countertopSpecs.map((spec, index) => (
                <div key={spec.id || index} className={styles.specCard}>
                  <div className={styles.specTitle}>
                    {spec.title?.trim() || `Area #${index + 1}`}
                  </div>
                  <div>
                    Sink Selection: {formatEnumValue(spec.sinkSelection) || "-"}
                  </div>
                  {spec.sinkSelection === "gmd-sink" ? (
                    <>
                      <div>
                        Sink Type: {formatEnumValue(spec.gmdSinkType) || "-"}
                      </div>
                      <div>
                        Sink Model:{" "}
                        {formatEnumValue(spec.fabricatedSinkStyle) ||
                          spec.kitchenBathroomModel ||
                          "-"}
                      </div>
                    </>
                  ) : null}
                  <div>
                    Edge Thickness: {formatEnumValue(spec.edgeThickness) || "-"}
                  </div>
                  <div>
                    Edge Profile: {formatEnumValue(spec.edgeProfile) || "-"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
