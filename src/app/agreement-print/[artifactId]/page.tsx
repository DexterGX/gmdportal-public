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

const BLANK_LINE_TOKEN = "__BLANK_LINE__";

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
  const lines = normalized.split("\n").map((line) => {
    const trimmedEnd = line.replace(/\s+$/g, "");
    return trimmedEnd.length === 0 ? BLANK_LINE_TOKEN : trimmedEnd;
  });

  // Drop leading/trailing blank runs and limit consecutive blank lines.
  const trimmed = [...lines];
  while (trimmed[0] === BLANK_LINE_TOKEN) {
    trimmed.shift();
  }
  while (trimmed[trimmed.length - 1] === BLANK_LINE_TOKEN) {
    trimmed.pop();
  }

  const compact: string[] = [];
  let blankRun = 0;
  for (const line of trimmed) {
    if (line === BLANK_LINE_TOKEN) {
      blankRun += 1;
      if (blankRun <= 3) {
        compact.push(line);
      }
    } else {
      blankRun = 0;
      compact.push(line);
    }
  }

  return compact;
}

const FIRST_PAGE_CHAR_BUDGET = 6200;
const NEXT_PAGE_CHAR_BUDGET = 7800;
const LONG_PARAGRAPH_CHUNK = 1600;
const BLANK_LINE_CHAR_WEIGHT = 120;

function splitLongParagraph(paragraph: string, maxChunk: number): string[] {
  if (paragraph === BLANK_LINE_TOKEN) {
    return [BLANK_LINE_TOKEN];
  }

  if (paragraph.length <= maxChunk) {
    return [paragraph];
  }

  const sentenceParts = paragraph
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentenceParts.length <= 1) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChunk && current) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
  }

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentenceParts) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maxChunk && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function paginateParagraphs(paragraphs: string[]): string[][] {
  const normalizedParagraphs = paragraphs.flatMap((paragraph) =>
    splitLongParagraph(paragraph, LONG_PARAGRAPH_CHUNK),
  );

  const pages: string[][] = [];
  let currentPage: string[] = [];
  let currentChars = 0;
  let pageBudget = FIRST_PAGE_CHAR_BUDGET;

  for (const paragraph of normalizedParagraphs) {
    const paragraphChars =
      paragraph === BLANK_LINE_TOKEN
        ? BLANK_LINE_CHAR_WEIGHT
        : paragraph.length;

    if (currentPage.length > 0 && currentChars + paragraphChars > pageBudget) {
      pages.push(currentPage);
      currentPage = [];
      currentChars = 0;
      pageBudget = NEXT_PAGE_CHAR_BUDGET;
    }

    currentPage.push(paragraph);
    currentChars += paragraphChars;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  const nonEmptyPages = pages
    .map((page) =>
      page.filter(
        (paragraph) =>
          paragraph === BLANK_LINE_TOKEN || paragraph.trim().length > 0,
      ),
    )
    .filter((page) => page.length > 0);

  return nonEmptyPages.length > 0 ? nonEmptyPages : [[""]];
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
  const specsParagraphs = countertopSpecs.flatMap((spec, index) => {
    const lines = [
      `Countertop Area ${index + 1}: ${spec.title?.trim() || `Area #${index + 1}`}`,
      `Sink Selection: ${formatEnumValue(spec.sinkSelection) || "-"}`,
      `Sink Type: ${formatEnumValue(spec.gmdSinkType) || "-"}`,
      `Sink Model: ${formatEnumValue(spec.fabricatedSinkStyle) || spec.kitchenBathroomModel || "-"}`,
      `Edge Thickness: ${formatEnumValue(spec.edgeThickness) || "-"}`,
      `Edge Profile: ${formatEnumValue(spec.edgeProfile) || "-"}`,
    ];

    return lines.join(". ");
  });
  const paginatedPages = paginateParagraphs([
    ...paragraphs,
    ...specsParagraphs,
  ]);

  return (
    <main className={styles.screen}>
      {shouldAutoPrint ? <AutoPrintClient title={pageTitle} /> : null}
      <div className={styles.pagesRoot}>
        {paginatedPages.map((pageParagraphs, pageIndex) => (
          <section
            key={`agreement-page-${pageIndex}`}
            className={`${styles.agreementPage} ${pageIndex === 0 ? styles.agreementPageFirst : styles.agreementPageContinuation}`}
          >
            {pageIndex === 0 ? (
              <div className={styles.headerBlock}>
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
                      {invoiceNumbers.length > 0
                        ? invoiceNumbers.join(", ")
                        : "-"}
                    </div>
                  </div>
                </header>
              </div>
            ) : null}

            <div
              className={`${styles.bodyBlock} ${pageIndex === 0 ? styles.bodyBlockFirst : styles.bodyBlockContinuation}`}
            >
              {pageIndex === 0 ? (
                <h1 className={styles.centeredTitle}>{title}</h1>
              ) : null}

              <section className={styles.contentBlock}>
                <div className={styles.legalColumnsGrid}>
                  {pageParagraphs.length > 0 ? (
                    pageParagraphs.map((paragraph, index) => (
                      <p
                        key={`${agreementKey}-page-${pageIndex}-paragraph-${index}`}
                        className={`${styles.legalParagraph} ${paragraph === BLANK_LINE_TOKEN ? styles.blankLine : ""}`}
                      >
                        {paragraph === BLANK_LINE_TOKEN ? "\u00A0" : paragraph}
                      </p>
                    ))
                  ) : (
                    <p
                      className={styles.legalParagraph}
                    >{`${title} content has not been configured yet.`}</p>
                  )}
                </div>
              </section>
            </div>

            <div className={styles.footerBlock}>
              Initials: ____________________
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
