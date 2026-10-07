import { notFound, redirect } from "next/navigation";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  canAccessAnyProgram,
  getProgramUserContext,
} from "@/lib/programPermissions";
import { normalizeOptionKey } from "@/lib/countertopAgreementOptions";
import AutoPrintClient from "../../payment-term-print/[artifactId]/AutoPrintClient";
import styles from "./page.module.css";

type AgreementKey =
  | "cabinet_agreement"
  | "countertop_agreement"
  | "repair_agreement"
  | "honed_agreement";

type CountertopAgreementSpec = {
  id?: string;
  title?: string;
  sinkSelection?: string;
  gmdSinkType?: string;
  fabricatedSinkStyle?: string;
  kitchenBathroomBrand?: string;
  kitchenBathroomModel?: string;
  kitchenBathroomColor?: string;
  edgeThickness?: string;
  edgeProfile?: string;
  customEdgeProfile?: string;
};

type Meta = {
  customerName?: string;
  dealName?: string | null;
  countertopAgreementSpecs?: CountertopAgreementSpec[];
  invoices?: Array<{
    id?: string;
    invoiceNumber?: string;
    num?: string;
  }>;
};

type CountertopImageSetting = {
  category?: string;
  optionKey?: string;
  imageUrl?: string | null;
};

const prismaAny = prisma as any;

const AGREEMENT_TITLES: Record<AgreementKey, string> = {
  cabinet_agreement: "Cabinet Agreement",
  countertop_agreement: "Countertop Agreement",
  repair_agreement: "Repair Agreement",
  honed_agreement: "Honed Agreement",
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

function getSinkImageOptionKey(spec: CountertopAgreementSpec): string {
  const sinkSelection = normalizeOptionKey(spec.sinkSelection);
  if (sinkSelection === "gmd-sink") {
    const gmdSinkType = normalizeOptionKey(spec.gmdSinkType);
    if (gmdSinkType === "fabricated") {
      const fabricatedStyle = normalizeOptionKey(spec.fabricatedSinkStyle);
      if (fabricatedStyle === "slanted-mitered") {
        return "gmd-fabricated-sink-slanted-mitered";
      }
      if (fabricatedStyle === "slanted-undermount") {
        return "gmd-fabricated-sink-slanted-undermount";
      }
      if (fabricatedStyle === "rectangular-mitered") {
        return "gmd-fabricated-sink-rectangular-mitered";
      }
      if (fabricatedStyle === "rectangular-undermount") {
        return "gmd-fabricated-sink-rectangular-undermount";
      }
      return "gmd-sink";
    }

    if (gmdSinkType === "kitchen-bathroom") {
      return "gmd-kitchen-bathroom-sink";
    }
  }

  return sinkSelection;
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
const DETAILS_SPECS_PER_PAGE = 3;

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

function paginateSpecs(
  specs: CountertopAgreementSpec[],
  perPage: number,
): CountertopAgreementSpec[][] {
  if (specs.length === 0) return [];

  const pages: CountertopAgreementSpec[][] = [];
  for (let i = 0; i < specs.length; i += perPage) {
    pages.push(specs.slice(i, i + perPage));
  }

  return pages;
}

export default async function AgreementPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ artifactId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, appRoles, isActive } =
    await getProgramUserContext("paymentTerms");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  // Access is managed in Settings → Program Access (Payment Terms or Customers)
  if (!(await canAccessAnyProgram(["paymentTerms", "customersV2"]))) {
    redirect("/dashboard");
  }

  const { artifactId } = await params;
  const query = await searchParams;
  const agreementKey = query.key;
  const shouldAutoPrint = query.autoprint === "1";

  if (
    agreementKey !== "cabinet_agreement" &&
    agreementKey !== "countertop_agreement" &&
    agreementKey !== "repair_agreement" &&
    agreementKey !== "honed_agreement"
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
    agreementKey === "countertop_agreement"
      ? (() => {
          const querySpecs = parseSpecs(query.specs);
          if (querySpecs.length > 0) {
            return querySpecs;
          }
          return Array.isArray(meta.countertopAgreementSpecs)
            ? meta.countertopAgreementSpecs
            : [];
        })()
      : [];
  const countertopImageSettings: CountertopImageSetting[] =
    agreementKey === "countertop_agreement"
      ? await prismaAny.countertopAgreementImage.findMany({
          where: { imageUrl: { not: null } },
          select: {
            category: true,
            optionKey: true,
            imageUrl: true,
          },
        })
      : [];
  const countertopImageMap = new Map<string, string>();
  for (const row of countertopImageSettings) {
    const category = String(row.category || "").trim();
    const optionKey = normalizeOptionKey(row.optionKey);
    const imageUrl =
      typeof row.imageUrl === "string" ? row.imageUrl.trim() : "";

    if (!category || !optionKey || !imageUrl) continue;
    countertopImageMap.set(`${category}:${optionKey}`, imageUrl);
  }

  const kitchenBathroomSpecPairs =
    agreementKey === "countertop_agreement"
      ? Array.from(
          new Set(
            countertopSpecs
              .filter(
                (spec) =>
                  normalizeOptionKey(spec.sinkSelection) === "gmd-sink" &&
                  normalizeOptionKey(spec.gmdSinkType) === "kitchen-bathroom" &&
                  String(spec.kitchenBathroomBrand || "").trim() &&
                  String(spec.kitchenBathroomModel || "").trim(),
              )
              .map(
                (spec) =>
                  `${String(spec.kitchenBathroomBrand || "")
                    .trim()
                    .toLowerCase()}|||${String(spec.kitchenBathroomModel || "")
                    .trim()
                    .toLowerCase()}`,
              ),
          ),
        )
      : [];

  const sinkCatalogImageMap = new Map<string, string>();
  if (kitchenBathroomSpecPairs.length > 0) {
    const whereOr = kitchenBathroomSpecPairs
      .map((entry) => {
        const [brandName, model] = entry.split("|||");
        if (!brandName || !model) return null;
        return {
          brand: {
            name: {
              equals: brandName,
              mode: "insensitive",
            },
          },
          model: {
            equals: model,
            mode: "insensitive",
          },
        };
      })
      .filter(Boolean);

    if (whereOr.length > 0) {
      const catalogSinks = await prismaAny.sink.findMany({
        where: { OR: whereOr },
        select: {
          model: true,
          imageUrl: true,
          brand: {
            select: { name: true },
          },
        },
      });

      const modelImages = await prismaAny.sinkModelImage.findMany({
        where: { OR: whereOr },
        select: {
          model: true,
          imageUrl: true,
          brand: {
            select: { name: true },
          },
        },
      });

      const fallbackImageByKey = new Map<string, string>();
      for (const row of modelImages) {
        const brandName =
          typeof row?.brand?.name === "string"
            ? row.brand.name.trim().toLowerCase()
            : "";
        const model =
          typeof row?.model === "string" ? row.model.trim().toLowerCase() : "";
        const imageUrl =
          typeof row?.imageUrl === "string" ? row.imageUrl.trim() : "";
        if (brandName && model && imageUrl) {
          fallbackImageByKey.set(`${brandName}|||${model}`, imageUrl);
        }
      }

      for (const sink of catalogSinks) {
        const imageUrl =
          typeof sink?.imageUrl === "string" && sink.imageUrl.trim()
            ? sink.imageUrl.trim()
            : fallbackImageByKey.get(
                `${typeof sink?.brand?.name === "string" ? sink.brand.name.trim().toLowerCase() : ""}|||${typeof sink?.model === "string" ? sink.model.trim().toLowerCase() : ""}`,
              ) || "";
        const brandName =
          typeof sink?.brand?.name === "string"
            ? sink.brand.name.trim().toLowerCase()
            : "";
        const model =
          typeof sink?.model === "string"
            ? sink.model.trim().toLowerCase()
            : "";

        if (!imageUrl || !brandName || !model) continue;
        const key = `${brandName}|||${model}`;
        if (!sinkCatalogImageMap.has(key)) {
          sinkCatalogImageMap.set(key, imageUrl);
        }
      }
    }
  }
  const companyPhone =
    companySettings?.companyPhone || companySettings?.phoneNumber || "";
  const companyEmail =
    companySettings?.companyEmail || companySettings?.email || "";
  const companyWebsite =
    companySettings?.companyWebsite || companySettings?.website || "";
  const companyAddress =
    companySettings?.companyAddress || companySettings?.address || "";
  const showPrintGuides = Boolean(companySettings?.showPrintGuides);
  const paginatedPages = paginateParagraphs(paragraphs);
  const countertopDetailsPages =
    agreementKey === "countertop_agreement"
      ? paginateSpecs(countertopSpecs, DETAILS_SPECS_PER_PAGE)
      : [];

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
              <div
                className={`${styles.headerBlock} ${!showPrintGuides ? styles.guidesHidden : ""}`}
              >
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
              className={`${styles.bodyBlock} ${pageIndex === 0 ? styles.bodyBlockFirst : styles.bodyBlockContinuation} ${!showPrintGuides ? styles.guidesHidden : ""}`}
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

            <div
              className={`${styles.footerBlock} ${!showPrintGuides ? styles.guidesHidden : ""}`}
            >
              Initials: ____________________
            </div>
          </section>
        ))}

        {countertopDetailsPages.map((detailsPageSpecs, detailsPageIndex) => (
          <section
            key={`countertop-details-page-${detailsPageIndex}`}
            className={`${styles.agreementPage} ${styles.agreementPageContinuation} ${styles.countertopDetailsPage}`}
          >
            <div
              className={`${styles.bodyBlock} ${styles.bodyBlockContinuation} ${styles.detailsBodyBlock} ${!showPrintGuides ? styles.guidesHidden : ""}`}
            >
              <h1 className={styles.centeredTitle}>
                SINK/EDGE/THICKNESS DOCUMENT
              </h1>

              <section
                className={`${styles.contentBlock} ${styles.detailsContentBlock}`}
              >
                {detailsPageSpecs.map((spec, specIndex) => {
                  const areaNumber =
                    detailsPageIndex * DETAILS_SPECS_PER_PAGE + specIndex + 1;
                  const areaTitle = spec.title?.trim() || `Area #${areaNumber}`;
                  const sinkSelection =
                    formatEnumValue(spec.sinkSelection) || "-";
                  const sinkType = formatEnumValue(spec.gmdSinkType) || "-";
                  const fabricatedStyle =
                    formatEnumValue(spec.fabricatedSinkStyle) || "-";
                  const sinkBrand = spec.kitchenBathroomBrand?.trim() || "-";
                  const sinkModel = spec.kitchenBathroomModel?.trim() || "-";
                  const sinkColor = spec.kitchenBathroomColor?.trim() || "-";
                  const thickness = formatEnumValue(spec.edgeThickness) || "-";
                  const edgeProfile =
                    normalizeOptionKey(spec.edgeProfile) === "custom"
                      ? spec.customEdgeProfile?.trim() || "Custom"
                      : formatEnumValue(spec.edgeProfile) || "-";
                  const sinkImageOptionKey = getSinkImageOptionKey(spec);
                  const sinkCatalogImageKey = `${String(
                    spec.kitchenBathroomBrand || "",
                  )
                    .trim()
                    .toLowerCase()}|||${String(spec.kitchenBathroomModel || "")
                    .trim()
                    .toLowerCase()}`;
                  const sinkImageUrlFromCatalog =
                    sinkCatalogImageMap.get(sinkCatalogImageKey);
                  const sinkImageUrl =
                    sinkImageUrlFromCatalog ||
                    countertopImageMap.get(`sink:${sinkImageOptionKey}`);
                  const thicknessImageUrl = countertopImageMap.get(
                    `thickness:${normalizeOptionKey(spec.edgeThickness)}`,
                  );
                  const edgeImageUrl = countertopImageMap.get(
                    `edge:${normalizeOptionKey(spec.edgeProfile)}`,
                  );

                  return (
                    <article
                      key={spec.id || `countertop-area-${areaNumber}`}
                      className={styles.detailsCard}
                    >
                      <h2 className={styles.detailsCardTitle}>
                        Area #{areaNumber}: {areaTitle}
                      </h2>

                      <div className={styles.detailsFields}>
                        <div>
                          <span className={styles.detailsLabel}>
                            Sink Selection:
                          </span>{" "}
                          {sinkSelection}
                        </div>
                        {normalizeOptionKey(spec.sinkSelection) ===
                        "gmd-sink" ? (
                          <>
                            <div>
                              <span className={styles.detailsLabel}>
                                GMD Sink Type:
                              </span>{" "}
                              {sinkType}
                            </div>
                            {normalizeOptionKey(spec.gmdSinkType) ===
                            "fabricated" ? (
                              <div>
                                <span className={styles.detailsLabel}>
                                  Fabricated Style:
                                </span>{" "}
                                {fabricatedStyle}
                              </div>
                            ) : null}
                            {normalizeOptionKey(spec.gmdSinkType) ===
                            "kitchen-bathroom" ? (
                              <>
                                <div>
                                  <span className={styles.detailsLabel}>
                                    Sink Brand:
                                  </span>{" "}
                                  {sinkBrand}
                                </div>
                                <div>
                                  <span className={styles.detailsLabel}>
                                    Kitchen/Bathroom Model:
                                  </span>{" "}
                                  {sinkModel}
                                </div>
                                <div>
                                  <span className={styles.detailsLabel}>
                                    Color:
                                  </span>{" "}
                                  {sinkColor}
                                </div>
                              </>
                            ) : null}
                          </>
                        ) : null}
                        <div>
                          <span className={styles.detailsLabel}>
                            Thickness:
                          </span>{" "}
                          {thickness}
                        </div>
                        <div>
                          <span className={styles.detailsLabel}>
                            Edge Profile:
                          </span>{" "}
                          {edgeProfile}
                        </div>
                      </div>

                      <div className={styles.detailsPlaceholdersGrid}>
                        <div className={styles.detailsPlaceholderBox}>
                          {sinkImageUrl ? (
                            <img
                              src={sinkImageUrl}
                              alt={`${sinkSelection} sink`}
                              className={styles.detailsPlaceholderImage}
                            />
                          ) : (
                            "Sink Image Placeholder"
                          )}
                        </div>
                        <div className={styles.detailsPlaceholderBox}>
                          {thicknessImageUrl ? (
                            <img
                              src={thicknessImageUrl}
                              alt={`${thickness} thickness`}
                              className={styles.detailsPlaceholderImage}
                            />
                          ) : (
                            "Thickness Image Placeholder"
                          )}
                        </div>
                        <div className={styles.detailsPlaceholderBox}>
                          {edgeImageUrl ? (
                            <img
                              src={edgeImageUrl}
                              alt={`${edgeProfile} edge profile`}
                              className={styles.detailsPlaceholderImage}
                            />
                          ) : (
                            "Edge Profile Image Placeholder"
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            </div>

            <div
              className={`${styles.footerBlock} ${!showPrintGuides ? styles.guidesHidden : ""}`}
            >
              Initials: ____________________
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
