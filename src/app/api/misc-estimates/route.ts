import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const prismaAny = prisma as any;
const MISC_ESTIMATE_NUMBER_PREFIX = "MC";

type LedStripRowPayload = {
  roomId?: string | null;
  room?: string;
  linearFeet?: number | null;
  lnFt?: number | null;
  ledTypeId?: string | null;
  ledType?: string;
  controlTypeId?: string | null;
  controlType?: string;
  profileId?: string | null;
  profile?: string;
  profileQty: number | null;
  subtotal: number | null;
};

type LedSheetRowPayload = {
  roomId?: string | null;
  room?: string;
  width?: number | null;
  widthIn?: number | null;
  height?: number | null;
  heightIn?: number | null;
  squareFeet?: number | null;
  sqFt?: number | null;
  sheetTypeId?: string | null;
  sheetType?: string;
  controlTypeId?: string | null;
  controlType?: string;
  subtotal?: number | null;
};

type GlassDoorShelfRowPayload = {
  width?: number | null;
  widthIn?: number | null;
  height?: number | null;
  heightIn?: number | null;
  squareFeet?: number | null;
  sqFt?: number | null;
  glassTypeId?: string | null;
  glassType?: string;
  quantity?: number | null;
  note?: string | null;
  subtotal?: number | null;
};

type IslandPanelRowPayload = {
  roomId?: string | null;
  room?: string;
  width?: number | null;
  widthIn?: number | null;
  height?: number | null;
  heightIn?: number | null;
  squareFeet?: number | null;
  sqFt?: number | null;
  panelModelId?: string | null;
  panelModel?: string;
  boxQty?: number | null;
  subtotal?: number | null;
};

type WallUnitRowPayload = {
  roomId?: string | null;
  room?: string;
  width?: number | null;
  widthIn?: number | null;
  height?: number | null;
  heightIn?: number | null;
  squareFeet?: number | null;
  sqFt?: number | null;
  note?: string | null;
  subtotal?: number | null;
};

type MirrorFrameRowPayload = {
  roomId?: string | null;
  room?: string;
  width?: number | null;
  widthIn?: number | null;
  height?: number | null;
  heightIn?: number | null;
  linearInches?: number | null;
  lnIn?: number | null;
  finishId?: string | null;
  finish?: string;
  painted?: boolean | string | null;
  color?: string | null;
  subtotal?: number | null;
};

type MirrorRowPayload = {
  roomId?: string | null;
  room?: string;
  width?: number | null;
  widthIn?: number | null;
  height?: number | null;
  heightIn?: number | null;
  squareFeet?: number | null;
  outlets?: number | null;
  lightCutout?: number | null;
  beveled?: boolean | null;
  beveledOptionId?: string | null;
  beveledOption?: string | null;
  colorId?: string | null;
  color?: string;
  note?: string | null;
  subtotal?: number | null;
};

type MirrorRemovalRowPayload = {
  width?: number | null;
  widthIn?: number | null;
  height?: number | null;
  heightIn?: number | null;
  squareFeet?: number | null;
  repairWall?: boolean | null;
  note?: string | null;
  subtotal?: number | null;
  repairWallSubtotal?: number | null;
  total?: number | null;
};

type ArtifactMeta = {
  estimateNumber?: string;
  [key: string]: unknown;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDateInput(value: string | undefined): Date {
  if (!value?.trim()) {
    return new Date();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function isChargeableMirrorBevelOption(
  option: { name?: string | null } | null | undefined,
) {
  const normalizedName = String(option?.name ?? "")
    .trim()
    .toLowerCase();
  return Boolean(normalizedName) && normalizedName !== "no";
}

function text(meta: ArtifactMeta, key: string): string {
  const value = meta[key];
  return typeof value === "string" && value.trim() ? value.trim() : "-";
}

const SECTION_LABELS: Record<string, string> = {
  LED_STRIP: "LED Strip",
  LED_SHEET: "LED Sheet",
  MIRROR: "Mirror",
  GLASS_DOOR_SHELF: "Glass Door/Shelf",
  ISLAND_PANEL: "Island Panel",
  WALL_UNIT: "Wall Unit",
  MIRROR_FRAME: "Mirror Frame",
};

type CompanyPrintInfo = {
  companyName: string;
  phoneNumber: string;
  address: string;
};

type LedRow = {
  room: string;
  lnFt: string;
  ledType: string;
  controlType: string;
  profile: string;
  profileQty: string;
  subtotal: string;
};

function toLedRows(meta: ArtifactMeta): LedRow[] {
  if (!Array.isArray(meta.ledStripRows)) return [];
  return meta.ledStripRows.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const n = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? String(v) : "";
    const s = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      room: s(row.room),
      lnFt: n(row.lnFt),
      ledType: s(row.ledType),
      controlType: s(row.controlType),
      profile: s(row.profile),
      profileQty: n(row.profileQty),
      subtotal: n(row.subtotal),
    };
  });
}

async function buildEstimatePdf(
  estimateNumber: string,
  meta: ArtifactMeta,
  companyInfo: CompanyPrintInfo,
) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([792, 612]); // Letter landscape
  const width = page.getWidth();
  const height = page.getHeight();

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const stroke = rgb(0, 0, 0);
  const darkHeader = rgb(0.38, 0.38, 0.38);

  const margin = 18;
  const contentW = width - margin * 2;
  const topY = height - margin;

  function drawBox(x: number, yTop: number, w: number, h: number) {
    page.drawRectangle({
      x,
      y: yTop - h,
      width: w,
      height: h,
      borderColor: stroke,
      borderWidth: 1,
    });
  }

  function drawTxt(
    value: string,
    x: number,
    y: number,
    opts?: { size?: number; isBold?: boolean },
  ) {
    page.drawText(value, {
      x,
      y,
      size: opts?.size ?? 9,
      font: opts?.isBold ? bold : regular,
      color: rgb(0, 0, 0),
    });
  }

  const section1H = 98;
  const section2H = 96;
  const gap = 6;

  const section1Top = topY;
  drawBox(margin, section1Top, contentW, section1H);

  const s1InnerPad = 6;
  const s1LeftW = Math.floor(contentW * 0.66);
  const s1RightW = contentW - s1LeftW;

  drawBox(
    margin + s1InnerPad,
    section1Top - s1InnerPad,
    s1LeftW - s1InnerPad * 1.5,
    section1H - s1InnerPad * 2,
  );
  drawBox(
    margin + s1LeftW,
    section1Top - s1InnerPad,
    s1RightW - s1InnerPad,
    section1H - s1InnerPad * 2,
  );

  const logoX = margin + 14;
  const logoYTop = section1Top - 10;
  drawBox(logoX, logoYTop, 92, 58);
  drawTxt("GM", logoX + 34, logoYTop - 18, { isBold: true, size: 18 });
  drawTxt("DESIGN", logoX + 18, logoYTop - 40, { isBold: true, size: 12 });

  const companyX = logoX + 104;
  drawTxt(companyInfo.companyName, companyX, section1Top - 24, {
    isBold: true,
    size: 10,
  });
  drawTxt(companyInfo.phoneNumber || "-", companyX, section1Top - 38, {
    size: 8,
  });
  drawTxt(companyInfo.address || "-", companyX, section1Top - 52, { size: 8 });

  const rightX = margin + s1LeftW + 8;
  const labelSize = 7;
  const valueSize = 8;

  drawTxt("Estimate #", rightX, section1Top - 16, {
    isBold: true,
    size: labelSize,
  });
  drawTxt("Date", rightX + 102, section1Top - 16, {
    isBold: true,
    size: labelSize,
  });
  drawBox(rightX, section1Top - 22, 96, 16);
  drawBox(rightX + 102, section1Top - 22, 90, 16);
  drawTxt(estimateNumber, rightX + 4, section1Top - 34, { size: valueSize });
  drawTxt(text(meta, "date"), rightX + 106, section1Top - 34, {
    size: valueSize,
  });

  drawTxt("Sales Rep", rightX, section1Top - 46, {
    isBold: true,
    size: labelSize,
  });
  drawBox(rightX, section1Top - 52, 192, 16);
  drawTxt(text(meta, "salesRep"), rightX + 4, section1Top - 64, {
    size: valueSize,
  });

  const section2Top = section1Top - section1H - gap;
  drawBox(margin, section2Top, contentW, section2H);

  const colW = contentW / 3;
  const col1X = margin;
  const col2X = margin + colW;
  const col3X = margin + colW * 2;

  drawBox(col1X + 2, section2Top - 2, colW - 4, section2H - 4);
  drawBox(col2X + 2, section2Top - 2, colW - 4, section2H - 4);
  drawBox(col3X + 2, section2Top - 2, colW - 4, section2H - 4);

  drawTxt("Title", col1X + 6, section2Top - 12, {
    isBold: true,
    size: labelSize,
  });
  drawBox(col1X + 6, section2Top - 16, colW - 16, 16);
  drawTxt(text(meta, "title"), col1X + 10, section2Top - 28, {
    size: valueSize,
  });

  drawTxt(
    "Client (PD ID, Name, Deal, Address, Contractor)",
    col1X + 6,
    section2Top - 34,
    { isBold: true, size: labelSize },
  );
  drawBox(col1X + 6, section2Top - 38, colW - 16, 16);
  drawTxt(text(meta, "customerName"), col1X + 10, section2Top - 50, {
    size: valueSize,
  });

  drawTxt("Client Info", col2X + 6, section2Top - 12, {
    isBold: true,
    size: labelSize,
  });
  drawTxt(
    `Client PD ID: ${text(meta, "customerPipedriveId")}`,
    col2X + 6,
    section2Top - 24,
    {
      isBold: true,
      size: labelSize,
    },
  );
  drawTxt(
    `Client Name: ${text(meta, "customerName")}`,
    col2X + 6,
    section2Top - 36,
    {
      isBold: true,
      size: labelSize,
    },
  );
  drawTxt(`Deal: ${text(meta, "dealName")}`, col2X + 6, section2Top - 48, {
    isBold: true,
    size: labelSize,
  });
  drawTxt(`Address: ${text(meta, "address")}`, col2X + 6, section2Top - 60, {
    isBold: true,
    size: labelSize,
  });
  drawTxt(
    `Contractor: ${text(meta, "contractor")}`,
    col2X + 6,
    section2Top - 72,
    {
      isBold: true,
      size: labelSize,
    },
  );

  drawTxt("Estimate Sections", col3X + 6, section2Top - 12, {
    isBold: true,
    size: labelSize,
  });
  const selected = Array.isArray(meta.selectedOptions)
    ? (meta.selectedOptions as string[])
    : [];
  const sectionKeys = Object.keys(SECTION_LABELS);
  sectionKeys.forEach((key, i) => {
    const row = i % 5;
    const col = i >= 5 ? 1 : 0;
    const x = col3X + 6 + col * ((colW - 12) / 2);
    const y = section2Top - 24 - row * 14;
    const isChecked = selected.includes(key);
    drawTxt(isChecked ? "[x]" : "[ ]", x, y, { size: valueSize });
    drawTxt(SECTION_LABELS[key], x + 16, y, { size: valueSize });
  });

  const section3Top = section2Top - section2H - gap;
  const section3H = 128;
  drawBox(margin, section3Top, contentW, section3H);

  page.drawRectangle({
    x: margin,
    y: section3Top - 18,
    width: contentW,
    height: 18,
    color: darkHeader,
  });
  drawTxt("LED STRIP", margin + 8, section3Top - 13, {
    isBold: true,
    size: 10,
  });

  const tableTop = section3Top - 18;
  const tableCols = [130, 95, 95, 115, 100, 90, 95];
  const headers = [
    "Room",
    "Ln.Ft.",
    "LED Type",
    "Control Type",
    "Profile",
    "Profile Qty",
    "Subtotal",
  ];

  const rowH = 18;
  const startX = margin;
  let cursorX = startX;
  headers.forEach((header, idx) => {
    const w = tableCols[idx];
    drawBox(cursorX, tableTop, w, rowH);
    drawTxt(header, cursorX + 4, tableTop - 12, { isBold: true, size: 7 });
    cursorX += w;
  });

  const rows = toLedRows(meta);
  const drawRows = Math.max(4, rows.length);

  for (let r = 0; r < drawRows; r++) {
    const row = rows[r] || {
      room: "",
      lnFt: "",
      ledType: "",
      controlType: "",
      profile: "",
      profileQty: "",
      subtotal: "",
    };
    const values = [
      row.room,
      row.lnFt,
      row.ledType,
      row.controlType,
      row.profile,
      row.profileQty,
      row.subtotal,
    ];

    let x = startX;
    const yTop = tableTop - rowH - r * rowH;
    values.forEach((value, idx) => {
      const w = tableCols[idx];
      drawBox(x, yTop, w, rowH);
      drawTxt(value, x + 4, yTop - 12, { size: 7 });
      x += w;
    });
  }

  const subtotalYTop = tableTop - rowH - drawRows * rowH;
  const mergedW = tableCols.slice(0, 6).reduce((a, b) => a + b, 0);
  drawBox(startX, subtotalYTop, mergedW, rowH);
  drawBox(startX + mergedW, subtotalYTop, tableCols[6], rowH);
  const subtotal =
    typeof meta.ledStripSubtotal === "number" &&
    Number.isFinite(meta.ledStripSubtotal)
      ? meta.ledStripSubtotal
      : 0;
  drawTxt(`$${subtotal.toFixed(2)}`, startX + mergedW + 60, subtotalYTop - 12, {
    isBold: true,
    size: 8,
  });

  const bytes = await pdf.save();
  return bytes;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requireUserEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return null;
  }
  return email;
}

async function generateMonthlyEstimateNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthToken = `${yy}${mm}`;
  const prefixedMonthToken = `${MISC_ESTIMATE_NUMBER_PREFIX}${monthToken}`;

  const monthEstimates = await prismaAny.miscEstimate.findMany({
    where: {
      OR: [
        {
          estimateNo: {
            startsWith: prefixedMonthToken,
          },
        },
        {
          estimateNo: {
            startsWith: monthToken,
          },
        },
      ],
    },
    select: { estimateNo: true },
    take: 5000,
  });

  let maxSequence = 0;
  const monthPattern = new RegExp(
    `^(?:${escapeRegExp(MISC_ESTIMATE_NUMBER_PREFIX)})?${escapeRegExp(monthToken)}(\\d+)$`,
  );

  for (const estimate of monthEstimates) {
    const value = String(estimate.estimateNo ?? "").trim();
    const match = value.match(monthPattern);
    if (!match) {
      continue;
    }
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      maxSequence = Math.max(maxSequence, parsed);
    }
  }

  const seq = String(maxSequence + 1).padStart(3, "0");
  return `${prefixedMonthToken}${seq}`;
}

async function generateVersionedEstimateNumber(sourceEstimateNumber: string) {
  const baseRaw = sourceEstimateNumber.split("-v")[0].trim();
  const base =
    /^\d+$/.test(baseRaw) && !baseRaw.startsWith(MISC_ESTIMATE_NUMBER_PREFIX)
      ? `${MISC_ESTIMATE_NUMBER_PREFIX}${baseRaw}`
      : baseRaw;

  if (!base) {
    return generateMonthlyEstimateNumber();
  }

  const estimates = await prismaAny.miscEstimate.findMany({
    where: {
      OR: [
        {
          estimateNo: {
            startsWith: base,
          },
        },
        ...(base !== baseRaw
          ? [
              {
                estimateNo: {
                  startsWith: baseRaw,
                },
              },
            ]
          : []),
      ],
    },
    select: { estimateNo: true },
    take: 5000,
  });

  let maxVersion = 1;
  const escapedBase = escapeRegExp(base);
  const versionPattern = new RegExp(`^${escapedBase}-v(\\d+)$`);

  for (const estimate of estimates) {
    const currentRaw = String(estimate.estimateNo ?? "").trim();
    const current =
      /^\d+(?:-v\d+)?$/.test(currentRaw) &&
      !currentRaw.startsWith(MISC_ESTIMATE_NUMBER_PREFIX)
        ? `${MISC_ESTIMATE_NUMBER_PREFIX}${currentRaw}`
        : currentRaw;
    if (current === base) {
      maxVersion = Math.max(maxVersion, 1);
      continue;
    }
    const match = current.match(versionPattern);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        maxVersion = Math.max(maxVersion, parsed);
      }
    }
  }

  return `${base}-v${maxVersion + 1}`;
}

function isEstimateNumberUniqueConstraintError(error: any) {
  if (error?.code !== "P2002") {
    return false;
  }
  const target = error?.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("estimateNo");
  }
  if (typeof target === "string") {
    return target.includes("estimateNo");
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const email = await requireUserEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const artifact = await prisma.jobArtifact.findFirst({
      where: { id, sourceApp: "MISC_ESTIMATE" },
      select: {
        id: true,
        title: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: "Estimate not found" },
        { status: 404 },
      );
    }

    const meta = (artifact.metadata ?? {}) as ArtifactMeta;
    const estimateNumber =
      typeof meta.estimateNumber === "string"
        ? meta.estimateNumber
        : artifact.id;

    const download = request.nextUrl.searchParams.get("download") === "1";
    if (download) {
      const companySettings =
        await prismaAny.companyDocumentSettings.findFirst();
      const companyInfo: CompanyPrintInfo = {
        companyName: companySettings?.companyName ?? "GM Design",
        phoneNumber: companySettings?.phoneNumber ?? "",
        address: companySettings?.address ?? "",
      };
      const pdfBytes = await buildEstimatePdf(
        estimateNumber,
        meta,
        companyInfo,
      );
      const pdfBytesCopy = Uint8Array.from(pdfBytes);
      const pdfArrayBuffer = pdfBytesCopy.buffer.slice(
        pdfBytesCopy.byteOffset,
        pdfBytesCopy.byteOffset + pdfBytesCopy.byteLength,
      );
      const pdfBlob = new Blob([pdfArrayBuffer], {
        type: "application/pdf",
      });
      return new NextResponse(pdfBlob, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${estimateNumber}.pdf"`,
        },
      });
    }

    return NextResponse.json({
      id: artifact.id,
      title: artifact.title,
      createdAt: artifact.createdAt,
      metadata: meta,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load estimate" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const email = await requireUserEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const artifact = await prisma.jobArtifact.findFirst({
      where: { id, sourceApp: "MISC_ESTIMATE" },
      select: { id: true },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: "Estimate not found" },
        { status: 404 },
      );
    }

    await prisma.jobArtifact.delete({ where: { id: artifact.id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete estimate" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const email = await requireUserEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      customerId,
      customerName,
      customerPipedriveId,
      jobId,
      dealId,
      dealName,
      address,
      contractor,
      date,
      salesRep,
      selectedOptions,
      ledStripRows,
      ledStripSubtotal,
      ledSheetRows,
      ledSheetSubtotal,
      glassDoorShelfRows,
      glassDoorShelfSubtotal,
      islandPanelRows,
      islandPanelSubtotal,
      wallUnitRows,
      wallUnitSubtotal,
      mirrorFrameRows,
      mirrorFrameSubtotal,
      mirrorRows,
      mirrorRemovalRows,
      mirrorSubtotal,
      mirrorRemovalSubtotal,
      sourceEstimateNumber,
    } = body as {
      title?: string;
      customerId?: string;
      customerName?: string;
      customerPipedriveId?: string | null;
      jobId?: string;
      dealId?: string | null;
      dealName?: string | null;
      address?: string | null;
      contractor?: string | null;
      date?: string;
      salesRep?: string;
      selectedOptions?: string[];
      ledStripRows?: LedStripRowPayload[];
      ledStripSubtotal?: number;
      ledSheetRows?: LedSheetRowPayload[];
      ledSheetSubtotal?: number;
      glassDoorShelfRows?: GlassDoorShelfRowPayload[];
      glassDoorShelfSubtotal?: number;
      islandPanelRows?: IslandPanelRowPayload[];
      islandPanelSubtotal?: number;
      wallUnitRows?: WallUnitRowPayload[];
      wallUnitSubtotal?: number;
      mirrorFrameRows?: MirrorFrameRowPayload[];
      mirrorFrameSubtotal?: number;
      mirrorRows?: MirrorRowPayload[];
      mirrorRemovalRows?: MirrorRemovalRowPayload[];
      mirrorSubtotal?: number;
      mirrorRemovalSubtotal?: number;
      sourceEstimateNumber?: string | null;
    };

    if (!title || !customerId || !jobId) {
      return NextResponse.json(
        { error: "Title, customer, and deal are required" },
        { status: 400 },
      );
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, customerId },
      select: { id: true, jobName: true },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Selected deal does not belong to selected client" },
        { status: 400 },
      );
    }

    const now = new Date();

    const actor = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const [
      rooms,
      ledTypes,
      controlTypes,
      profiles,
      sheetTypes,
      mirrorColors,
      glassDoorShelfTypes,
      islandPanelModels,
      mirrorFrameFinishes,
      mirrorBevelOptions,
      mirrorSetting,
      wallUnitSetting,
      mirrorFrameSetting,
    ] = await Promise.all([
      prismaAny.miscLedRoom.findMany({ select: { id: true, name: true } }),
      prismaAny.miscLedType.findMany({
        select: {
          id: true,
          name: true,
          minimumPriceUnder25Ft: true,
          pricePerFt: true,
        },
      }),
      prismaAny.miscLedControlType.findMany({
        select: { id: true, name: true, unitPrice: true },
      }),
      prismaAny.miscLedProfile.findMany({
        select: {
          id: true,
          name: true,
          unitPrice: true,
          groovePricePerFt: true,
        },
      }),
      prismaAny.miscLedSheetType.findMany({
        select: { id: true, name: true, minimumPrice: true, unitPrice: true },
      }),
      prismaAny.miscMirrorColor.findMany({
        select: { id: true, name: true, venda: true, custo: true },
      }),
      prismaAny.miscGlassDoorShelfType.findMany({
        select: { id: true, name: true, venda: true, custo: true },
      }),
      prismaAny.miscIslandPanelModel.findMany({
        select: { id: true, name: true, sfPerBox: true, salesPrice: true },
      }),
      prismaAny.miscMirrorFrameFinish.findMany({
        select: { id: true, name: true, pricePerLinearFt: true },
      }),
      prismaAny.miscMirrorBevelOption.findMany({
        select: { id: true, name: true, venda: true, custo: true },
      }),
      prismaAny.miscMirrorSetting.findFirst(),
      prismaAny.miscWallUnitSetting.findFirst(),
      prismaAny.miscMirrorFrameSetting.findFirst(),
    ]);

    const roomById = new Map<string, any>(
      rooms.map((item: any) => [String(item.id), item]),
    );
    const typeById = new Map<string, any>(
      ledTypes.map((item: any) => [String(item.id), item]),
    );
    const controlById = new Map<string, any>(
      controlTypes.map((item: any) => [String(item.id), item]),
    );
    const profileById = new Map<string, any>(
      profiles.map((item: any) => [String(item.id), item]),
    );
    const roomByName = new Map<string, any>(
      rooms.map((item: any) => [String(item.name).toLowerCase(), item]),
    );
    const typeByName = new Map<string, any>(
      ledTypes.map((item: any) => [String(item.name).toLowerCase(), item]),
    );
    const controlByName = new Map<string, any>(
      controlTypes.map((item: any) => [String(item.name).toLowerCase(), item]),
    );
    const profileByName = new Map<string, any>(
      profiles.map((item: any) => [String(item.name).toLowerCase(), item]),
    );
    const sheetTypeById = new Map<string, any>(
      sheetTypes.map((item: any) => [String(item.id), item]),
    );
    const sheetTypeByName = new Map<string, any>(
      sheetTypes.map((item: any) => [String(item.name).toLowerCase(), item]),
    );
    const mirrorColorById = new Map<string, any>(
      mirrorColors.map((item: any) => [String(item.id), item]),
    );
    const mirrorColorByName = new Map<string, any>(
      mirrorColors.map((item: any) => [String(item.name).toLowerCase(), item]),
    );
    const glassDoorShelfTypeById = new Map<string, any>(
      glassDoorShelfTypes.map((item: any) => [String(item.id), item]),
    );
    const glassDoorShelfTypeByName = new Map<string, any>(
      glassDoorShelfTypes.map((item: any) => [
        String(item.name).toLowerCase(),
        item,
      ]),
    );
    const islandPanelModelById = new Map<string, any>(
      islandPanelModels.map((item: any) => [String(item.id), item]),
    );
    const islandPanelModelByName = new Map<string, any>(
      islandPanelModels.map((item: any) => [
        String(item.name).toLowerCase(),
        item,
      ]),
    );
    const mirrorFrameFinishById = new Map<string, any>(
      mirrorFrameFinishes.map((item: any) => [String(item.id), item]),
    );
    const mirrorFrameFinishByName = new Map<string, any>(
      mirrorFrameFinishes.map((item: any) => [
        String(item.name).toLowerCase(),
        item,
      ]),
    );
    const mirrorBevelById = new Map<string, any>(
      mirrorBevelOptions.map((item: any) => [String(item.id), item]),
    );
    const mirrorBevelByName = new Map<string, any>(
      mirrorBevelOptions.map((item: any) => [
        String(item.name).toLowerCase(),
        item,
      ]),
    );

    const normalizedRows = (
      Array.isArray(ledStripRows) ? ledStripRows : []
    ).map((raw) => {
      const roomIdRaw = raw.roomId?.trim() || "";
      const roomNameRaw = raw.room?.trim() || "";
      const roomResolved =
        roomById.get(roomIdRaw) || roomByName.get(roomNameRaw.toLowerCase());

      const ledTypeIdRaw = raw.ledTypeId?.trim() || "";
      const ledTypeNameRaw = raw.ledType?.trim() || "";
      const ledTypeResolved =
        typeById.get(ledTypeIdRaw) ||
        typeByName.get(ledTypeNameRaw.toLowerCase());

      const controlTypeIdRaw = raw.controlTypeId?.trim() || "";
      const controlTypeNameRaw = raw.controlType?.trim() || "";
      const controlTypeResolved =
        controlById.get(controlTypeIdRaw) ||
        controlByName.get(controlTypeNameRaw.toLowerCase());

      const profileIdRaw = raw.profileId?.trim() || "";
      const profileNameRaw = raw.profile?.trim() || "";
      const profileResolved =
        profileById.get(profileIdRaw) ||
        profileByName.get(profileNameRaw.toLowerCase());

      const linearFeet = toNumber(raw.linearFeet ?? raw.lnFt);
      const profileIsYes =
        String(profileResolved?.name || "")
          .trim()
          .toLowerCase() === "yes";
      const profileQty =
        profileIsYes && linearFeet > 0 ? Math.ceil(linearFeet / 8) : 0;
      const minimumPrice = toNumber(ledTypeResolved?.minimumPriceUnder25Ft);
      const perFootPrice = toNumber(ledTypeResolved?.pricePerFt);
      const ledBasePrice =
        linearFeet <= 0
          ? 0
          : linearFeet <= 25
            ? minimumPrice
            : minimumPrice + (linearFeet - 25) * perFootPrice;
      const groovePerFt = toNumber(profileResolved?.groovePricePerFt);
      const profilePrice = toNumber(profileResolved?.unitPrice);
      const profileAndGrooveCharge = profileIsYes
        ? profileQty * profilePrice + linearFeet * groovePerFt
        : 0;
      const rowSubtotal = ledBasePrice + profileAndGrooveCharge;

      return {
        roomId: roomResolved?.id ?? null,
        roomName: roomResolved?.name ?? roomNameRaw,
        linearFeet,
        ledTypeId: ledTypeResolved?.id ?? null,
        ledTypeName: ledTypeResolved?.name ?? ledTypeNameRaw,
        controlTypeId: controlTypeResolved?.id ?? null,
        controlTypeName: controlTypeResolved?.name ?? controlTypeNameRaw,
        profileId: profileResolved?.id ?? null,
        profileName: profileResolved?.name ?? profileNameRaw,
        profileQty,
        subtotal: rowSubtotal,
      };
    });

    const computedLedSubtotal = normalizedRows.reduce(
      (sum, row) => sum + toNumber(row.subtotal),
      0,
    );

    const normalizedSheetRows = (
      Array.isArray(ledSheetRows) ? ledSheetRows : []
    ).map((raw) => {
      const roomIdRaw = raw.roomId?.trim() || "";
      const roomNameRaw = raw.room?.trim() || "";
      const roomResolved =
        roomById.get(roomIdRaw) || roomByName.get(roomNameRaw.toLowerCase());

      const sheetTypeIdRaw = raw.sheetTypeId?.trim() || "";
      const sheetTypeNameRaw = raw.sheetType?.trim() || "";
      const sheetTypeResolved =
        sheetTypeById.get(sheetTypeIdRaw) ||
        sheetTypeByName.get(sheetTypeNameRaw.toLowerCase());

      const controlTypeIdRaw = raw.controlTypeId?.trim() || "";
      const controlTypeNameRaw = raw.controlType?.trim() || "";
      const controlTypeResolved =
        controlById.get(controlTypeIdRaw) ||
        controlByName.get(controlTypeNameRaw.toLowerCase());

      const width = toNumber(raw.width ?? raw.widthIn);
      const height = toNumber(raw.height ?? raw.heightIn);
      const squareFeet =
        width > 0 && height > 0 ? Math.ceil((width * height) / 144) : 0;
      const sheetTypePrice = toNumber(sheetTypeResolved?.unitPrice);
      const minimumSheetPrice = toNumber(sheetTypeResolved?.minimumPrice);
      const rowSubtotal =
        squareFeet > 0 && sheetTypeResolved
          ? Math.max(minimumSheetPrice, sheetTypePrice * squareFeet)
          : 0;

      return {
        roomId: roomResolved?.id ?? null,
        roomName: roomResolved?.name ?? roomNameRaw,
        width,
        height,
        squareFeet,
        sheetTypeId: sheetTypeResolved?.id ?? null,
        sheetTypeName: sheetTypeResolved?.name ?? sheetTypeNameRaw,
        controlTypeId: controlTypeResolved?.id ?? null,
        controlTypeName: controlTypeResolved?.name ?? controlTypeNameRaw,
        subtotal: rowSubtotal,
      };
    });

    const computedLedSheetSubtotal = normalizedSheetRows.reduce(
      (sum, row) => sum + toNumber(row.subtotal),
      0,
    );

    const normalizedGlassDoorShelfRows = (
      Array.isArray(glassDoorShelfRows) ? glassDoorShelfRows : []
    ).map((raw) => {
      const glassTypeIdRaw = raw.glassTypeId?.trim() || "";
      const glassTypeNameRaw = raw.glassType?.trim() || "";
      const glassTypeResolved =
        glassDoorShelfTypeById.get(glassTypeIdRaw) ||
        glassDoorShelfTypeByName.get(glassTypeNameRaw.toLowerCase());

      const width = toNumber(raw.width ?? raw.widthIn);
      const height = toNumber(raw.height ?? raw.heightIn);
      const squareFeet = width > 0 && height > 0 ? (width * height) / 144 : 0;
      const quantity = Math.max(0, toNumber(raw.quantity));
      const cuttingFee = toNumber(mirrorSetting?.cuttingFee);
      const glassUnitSale = toNumber(glassTypeResolved?.venda);
      const rowSubtotal =
        glassTypeResolved && squareFeet > 0 && quantity > 0
          ? squareFeet * glassUnitSale * quantity + cuttingFee * quantity
          : 0;

      return {
        width,
        height,
        squareFeet,
        glassTypeId: glassTypeResolved?.id ?? null,
        glassTypeName: glassTypeResolved?.name ?? glassTypeNameRaw,
        quantity,
        note: raw.note?.trim() || "",
        subtotal: rowSubtotal,
      };
    });

    const computedGlassDoorShelfSubtotal = normalizedGlassDoorShelfRows.reduce(
      (sum, row) => sum + toNumber(row.subtotal),
      0,
    );

    const normalizedIslandPanelRows = (
      Array.isArray(islandPanelRows) ? islandPanelRows : []
    ).map((raw) => {
      const roomIdRaw = raw.roomId?.trim() || "";
      const roomNameRaw = raw.room?.trim() || "";
      const roomResolved =
        roomById.get(roomIdRaw) || roomByName.get(roomNameRaw.toLowerCase());

      const panelModelIdRaw = raw.panelModelId?.trim() || "";
      const panelModelNameRaw = raw.panelModel?.trim() || "";
      const panelModelResolved =
        islandPanelModelById.get(panelModelIdRaw) ||
        islandPanelModelByName.get(panelModelNameRaw.toLowerCase());

      const width = toNumber(raw.width ?? raw.widthIn);
      const height = toNumber(raw.height ?? raw.heightIn);
      const squareFeet = width > 0 && height > 0 ? (width * height) / 144 : 0;
      const sfPerBox = toNumber(panelModelResolved?.sfPerBox);
      const boxQty =
        panelModelResolved && squareFeet > 0 && sfPerBox > 0
          ? Math.ceil(squareFeet / sfPerBox)
          : 0;
      const rowSubtotal =
        panelModelResolved && boxQty > 0
          ? toNumber(panelModelResolved?.salesPrice) * boxQty
          : 0;

      return {
        roomId: roomResolved?.id ?? null,
        roomName: roomResolved?.name ?? roomNameRaw,
        panelModelId: panelModelResolved?.id ?? null,
        panelModelName: panelModelResolved?.name ?? panelModelNameRaw,
        width,
        height,
        squareFeet,
        boxQty,
        subtotal: rowSubtotal,
      };
    });

    const computedIslandPanelSubtotal = normalizedIslandPanelRows.reduce(
      (sum, row) => sum + toNumber(row.subtotal),
      0,
    );

    const normalizedWallUnitRows = (
      Array.isArray(wallUnitRows) ? wallUnitRows : []
    ).map((raw) => {
      const roomIdRaw = raw.roomId?.trim() || "";
      const roomNameRaw = raw.room?.trim() || "";
      const roomResolved =
        roomById.get(roomIdRaw) || roomByName.get(roomNameRaw.toLowerCase());

      const width = toNumber(raw.width ?? raw.widthIn);
      const height = toNumber(raw.height ?? raw.heightIn);
      const squareFeet = width > 0 && height > 0 ? (width * height) / 144 : 0;
      const rowSubtotal =
        squareFeet > 0
          ? squareFeet * toNumber(wallUnitSetting?.constructionPricePerSqFt)
          : 0;

      return {
        roomId: roomResolved?.id ?? null,
        roomName: roomResolved?.name ?? roomNameRaw,
        width,
        height,
        squareFeet,
        note: raw.note?.trim() || "",
        subtotal: rowSubtotal,
      };
    });

    const computedWallUnitSubtotal = normalizedWallUnitRows.reduce(
      (sum, row) => sum + toNumber(row.subtotal),
      0,
    );

    const normalizedMirrorFrameRows = (
      Array.isArray(mirrorFrameRows) ? mirrorFrameRows : []
    ).map((raw) => {
      const roomIdRaw = raw.roomId?.trim() || "";
      const roomNameRaw = raw.room?.trim() || "";
      const roomResolved =
        roomById.get(roomIdRaw) || roomByName.get(roomNameRaw.toLowerCase());

      const finishIdRaw = raw.finishId?.trim() || "";
      const finishNameRaw = raw.finish?.trim() || "";
      const finishResolved =
        mirrorFrameFinishById.get(finishIdRaw) ||
        mirrorFrameFinishByName.get(finishNameRaw.toLowerCase());

      const width = toNumber(raw.width ?? raw.widthIn);
      const height = toNumber(raw.height ?? raw.heightIn);
      const linearInches = width > 0 && height > 0 ? (width + height) * 2 : 0;
      const painted =
        raw.painted === true ||
        String(raw.painted || "")
          .trim()
          .toLowerCase() === "yes";

      const base =
        linearInches > 0 && finishResolved
          ? Math.max(
              linearInches * toNumber(finishResolved?.pricePerLinearFt),
              toNumber(mirrorFrameSetting?.minimumCharge),
            )
          : 0;
      const rowSubtotal = painted
        ? base * toNumber(mirrorFrameSetting?.paintingFactor || 1)
        : base;

      return {
        roomId: roomResolved?.id ?? null,
        roomName: roomResolved?.name ?? roomNameRaw,
        finishId: finishResolved?.id ?? null,
        finishName: finishResolved?.name ?? finishNameRaw,
        width,
        height,
        linearInches,
        painted,
        color: raw.color?.trim() || "",
        subtotal: rowSubtotal,
      };
    });

    const computedMirrorFrameSubtotal = normalizedMirrorFrameRows.reduce(
      (sum, row) => sum + toNumber(row.subtotal),
      0,
    );

    const normalizedMirrorRows = (
      Array.isArray(mirrorRows) ? mirrorRows : []
    ).map((raw) => {
      const roomIdRaw = raw.roomId?.trim() || "";
      const roomNameRaw = raw.room?.trim() || "";
      const roomResolved =
        roomById.get(roomIdRaw) || roomByName.get(roomNameRaw.toLowerCase());

      const colorIdRaw = raw.colorId?.trim() || "";
      const colorNameRaw = raw.color?.trim() || "";
      const colorResolved =
        mirrorColorById.get(colorIdRaw) ||
        mirrorColorByName.get(colorNameRaw.toLowerCase());

      const beveledOptionIdRaw = raw.beveledOptionId?.trim() || "";
      const beveledOptionNameRaw = raw.beveledOption?.trim() || "";
      const beveledOptionResolved =
        mirrorBevelById.get(beveledOptionIdRaw) ||
        mirrorBevelByName.get(beveledOptionNameRaw.toLowerCase());

      const width = toNumber(raw.width ?? raw.widthIn);
      const height = toNumber(raw.height ?? raw.heightIn);
      const squareFeet = width > 0 && height > 0 ? (width * height) / 144 : 0;
      const outlets = Math.max(0, Math.floor(toNumber(raw.outlets)));
      const lightCutout = Math.max(0, Math.floor(toNumber(raw.lightCutout)));
      const beveled = beveledOptionResolved
        ? isChargeableMirrorBevelOption(beveledOptionResolved)
        : raw.beveled === true;
      const perimeter = width > 0 && height > 0 ? width * 2 + height * 2 : 0;

      const colorVenda = toNumber(colorResolved?.venda);
      const outletSale = toNumber(mirrorSetting?.outletSale);
      const lightCutoutSale = toNumber(mirrorSetting?.lightCutoutSale);
      const beveledPerInchSale = toNumber(beveledOptionResolved?.venda);
      const outOfSquareBeveledSale = toNumber(
        mirrorSetting?.outOfSquareBeveledSale,
      );

      const subtotal = colorResolved
        ? squareFeet * colorVenda +
          outlets * outletSale +
          lightCutout * lightCutoutSale +
          (beveled ? perimeter * beveledPerInchSale : 0) +
          (beveled ? outOfSquareBeveledSale : 0)
        : 0;

      return {
        roomId: roomResolved?.id ?? null,
        roomName: roomResolved?.name ?? roomNameRaw,
        colorId: colorResolved?.id ?? null,
        colorName: colorResolved?.name ?? colorNameRaw,
        beveledOptionId: beveledOptionResolved?.id ?? null,
        beveledOptionName: beveledOptionResolved?.name ?? beveledOptionNameRaw,
        width,
        height,
        squareFeet,
        outlets,
        lightCutout,
        beveled,
        note: raw.note?.trim() || "",
        subtotal,
      };
    });

    const computedMirrorSubtotal = normalizedMirrorRows.reduce(
      (sum, row) => sum + toNumber(row.subtotal),
      0,
    );

    const normalizedMirrorRemovalRows = (
      Array.isArray(mirrorRemovalRows) ? mirrorRemovalRows : []
    ).map((raw) => {
      const width = toNumber(raw.width ?? raw.widthIn);
      const height = toNumber(raw.height ?? raw.heightIn);
      const squareFeet = width > 0 && height > 0 ? (width * height) / 144 : 0;
      const repairWall = raw.repairWall === true;
      const subtotal =
        squareFeet * toNumber(mirrorSetting?.removalPricePerSqFt);
      const repairWallSubtotal = repairWall
        ? subtotal * toNumber(mirrorSetting?.repairWallMultiplier)
        : 0;
      const total = subtotal + repairWallSubtotal;

      return {
        width,
        height,
        squareFeet,
        repairWall,
        note: raw.note?.trim() || "",
        subtotal,
        repairWallSubtotal,
        total,
      };
    });

    const computedMirrorRemovalSubtotal = normalizedMirrorRemovalRows.reduce(
      (sum, row) => sum + toNumber(row.total),
      0,
    );

    const computedSubtotal =
      computedLedSubtotal +
      computedLedSheetSubtotal +
      computedGlassDoorShelfSubtotal +
      computedIslandPanelSubtotal +
      computedWallUnitSubtotal +
      computedMirrorFrameSubtotal +
      computedMirrorSubtotal +
      computedMirrorRemovalSubtotal;

    const safeSelectedOptions = Array.isArray(selectedOptions)
      ? selectedOptions
      : [];

    const maxSaveAttempts = 3;
    let estimateNumber = "";
    let miscEstimate: any = null;
    let artifact: any = null;

    for (let attempt = 1; attempt <= maxSaveAttempts; attempt += 1) {
      estimateNumber = sourceEstimateNumber?.trim()
        ? await generateVersionedEstimateNumber(sourceEstimateNumber)
        : await generateMonthlyEstimateNumber();

      try {
        const saved = await prisma.$transaction(async (tx) => {
          const txAny = tx as any;

          const createdEstimate = await txAny.miscEstimate.create({
            data: {
              estimateNo: estimateNumber,
              title,
              clientName: customerName ?? null,
              clientId: customerId,
              dealName: dealName ?? null,
              dealId: dealId ?? null,
              date: parseDateInput(date),
              salesRep: salesRep?.trim() || "",
              status: "DRAFT",
              subtotal: computedSubtotal,
              discount: 0,
              total: computedSubtotal,
              createdById: actor?.id ?? null,
              ledRows: {
                create: normalizedRows.map((row) => ({
                  roomId: row.roomId,
                  ledTypeId: row.ledTypeId,
                  controlTypeId: row.controlTypeId,
                  profileId: row.profileId,
                  linearFeet: row.linearFeet,
                  profileQty: row.profileQty,
                  subtotal: row.subtotal,
                })),
              },
              ledSheetRows: {
                create: normalizedSheetRows.map((row) => ({
                  roomId: row.roomId,
                  sheetTypeId: row.sheetTypeId,
                  controlTypeId: row.controlTypeId,
                  widthIn: row.width,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  subtotal: row.subtotal,
                })),
              },
              glassDoorShelfRows: {
                create: normalizedGlassDoorShelfRows.map((row) => ({
                  glassTypeId: row.glassTypeId,
                  widthIn: row.width,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  quantity: row.quantity,
                  note: row.note,
                  subtotal: row.subtotal,
                })),
              },
              islandPanelRows: {
                create: normalizedIslandPanelRows.map((row) => ({
                  roomId: row.roomId,
                  panelModelId: row.panelModelId,
                  widthIn: row.width,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  boxQty: row.boxQty,
                  subtotal: row.subtotal,
                })),
              },
              wallUnitRows: {
                create: normalizedWallUnitRows.map((row) => ({
                  roomId: row.roomId,
                  widthIn: row.width,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  note: row.note,
                  subtotal: row.subtotal,
                })),
              },
              mirrorFrameRows: {
                create: normalizedMirrorFrameRows.map((row) => ({
                  roomId: row.roomId,
                  finishId: row.finishId,
                  widthIn: row.width,
                  heightIn: row.height,
                  linearInches: row.linearInches,
                  painted: row.painted,
                  color: row.color,
                  subtotal: row.subtotal,
                })),
              },
              mirrorRows: {
                create: normalizedMirrorRows.map((row) => ({
                  roomId: row.roomId,
                  colorId: row.colorId,
                  beveledOptionId: row.beveledOptionId,
                  widthIn: row.width,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  outlets: row.outlets,
                  lightCutouts: row.lightCutout,
                  beveled: row.beveled,
                  note: row.note,
                  subtotal: row.subtotal,
                })),
              },
              mirrorRemovalRows: {
                create: normalizedMirrorRemovalRows.map((row) => ({
                  widthIn: row.width,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  repairWall: row.repairWall,
                  subtotal: row.subtotal,
                  repairWallSubtotal: row.repairWallSubtotal,
                  total: row.total,
                })),
              },
            },
          });

          const createdArtifact = await tx.jobArtifact.create({
            data: {
              jobId,
              sourceApp: "MISC_ESTIMATE",
              type: "SNAPSHOT",
              title: `${title} ${estimateNumber}`,
              metadata: {
                estimateNumber,
                title,
                customerId,
                customerName,
                customerPipedriveId,
                dealId,
                dealName,
                address,
                contractor,
                date,
                salesRep,
                miscEstimateId: createdEstimate.id,
                selectedOptions: safeSelectedOptions,
                ledStripRows: normalizedRows.map((row) => ({
                  roomId: row.roomId,
                  room: row.roomName,
                  lnFt: row.linearFeet,
                  linearFeet: row.linearFeet,
                  ledTypeId: row.ledTypeId,
                  ledType: row.ledTypeName,
                  controlTypeId: row.controlTypeId,
                  controlType: row.controlTypeName,
                  profileId: row.profileId,
                  profile: row.profileName,
                  profileQty: row.profileQty,
                  subtotal: row.subtotal,
                })),
                ledStripSubtotal: computedLedSubtotal,
                ledStripSubtotalInput: Number.isFinite(ledStripSubtotal)
                  ? Number(ledStripSubtotal)
                  : 0,
                ledSheetRows: normalizedSheetRows.map((row) => ({
                  roomId: row.roomId,
                  room: row.roomName,
                  width: row.width,
                  widthIn: row.width,
                  height: row.height,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  sqFt: row.squareFeet,
                  sheetTypeId: row.sheetTypeId,
                  sheetType: row.sheetTypeName,
                  controlTypeId: row.controlTypeId,
                  controlType: row.controlTypeName,
                  subtotal: row.subtotal,
                })),
                ledSheetSubtotal: computedLedSheetSubtotal,
                ledSheetSubtotalInput: Number.isFinite(ledSheetSubtotal)
                  ? Number(ledSheetSubtotal)
                  : 0,
                glassDoorShelfRows: normalizedGlassDoorShelfRows.map((row) => ({
                  width: row.width,
                  widthIn: row.width,
                  height: row.height,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  sqFt: row.squareFeet,
                  glassTypeId: row.glassTypeId,
                  glassType: row.glassTypeName,
                  quantity: row.quantity,
                  note: row.note,
                  subtotal: row.subtotal,
                })),
                glassDoorShelfSubtotal: computedGlassDoorShelfSubtotal,
                glassDoorShelfSubtotalInput: Number.isFinite(
                  glassDoorShelfSubtotal,
                )
                  ? Number(glassDoorShelfSubtotal)
                  : 0,
                islandPanelRows: normalizedIslandPanelRows.map((row) => ({
                  roomId: row.roomId,
                  room: row.roomName,
                  width: row.width,
                  widthIn: row.width,
                  height: row.height,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  sqFt: row.squareFeet,
                  panelModelId: row.panelModelId,
                  panelModel: row.panelModelName,
                  boxQty: row.boxQty,
                  subtotal: row.subtotal,
                })),
                islandPanelSubtotal: computedIslandPanelSubtotal,
                islandPanelSubtotalInput: Number.isFinite(islandPanelSubtotal)
                  ? Number(islandPanelSubtotal)
                  : 0,
                wallUnitRows: normalizedWallUnitRows.map((row) => ({
                  roomId: row.roomId,
                  room: row.roomName,
                  width: row.width,
                  widthIn: row.width,
                  height: row.height,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  sqFt: row.squareFeet,
                  note: row.note,
                  subtotal: row.subtotal,
                })),
                wallUnitSubtotal: computedWallUnitSubtotal,
                wallUnitSubtotalInput: Number.isFinite(wallUnitSubtotal)
                  ? Number(wallUnitSubtotal)
                  : 0,
                mirrorFrameRows: normalizedMirrorFrameRows.map((row) => ({
                  roomId: row.roomId,
                  room: row.roomName,
                  width: row.width,
                  widthIn: row.width,
                  height: row.height,
                  heightIn: row.height,
                  linearInches: row.linearInches,
                  lnIn: row.linearInches,
                  finishId: row.finishId,
                  finish: row.finishName,
                  painted: row.painted,
                  color: row.color,
                  subtotal: row.subtotal,
                })),
                mirrorFrameSubtotal: computedMirrorFrameSubtotal,
                mirrorFrameSubtotalInput: Number.isFinite(mirrorFrameSubtotal)
                  ? Number(mirrorFrameSubtotal)
                  : 0,
                mirrorRows: normalizedMirrorRows.map((row) => ({
                  roomId: row.roomId,
                  room: row.roomName,
                  colorId: row.colorId,
                  color: row.colorName,
                  beveledOptionId: row.beveledOptionId,
                  beveledOption: row.beveledOptionName,
                  width: row.width,
                  widthIn: row.width,
                  height: row.height,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  outlets: row.outlets,
                  lightCutout: row.lightCutout,
                  beveled: row.beveled,
                  note: row.note,
                  subtotal: row.subtotal,
                })),
                mirrorSubtotal: computedMirrorSubtotal,
                mirrorSubtotalInput: Number.isFinite(mirrorSubtotal)
                  ? Number(mirrorSubtotal)
                  : 0,
                mirrorRemovalRows: normalizedMirrorRemovalRows.map((row) => ({
                  width: row.width,
                  widthIn: row.width,
                  height: row.height,
                  heightIn: row.height,
                  squareFeet: row.squareFeet,
                  repairWall: row.repairWall,
                  note: row.note,
                  subtotal: row.subtotal,
                  repairWallSubtotal: row.repairWallSubtotal,
                  total: row.total,
                })),
                mirrorRemovalSubtotal: computedMirrorRemovalSubtotal,
                mirrorRemovalSubtotalInput: Number.isFinite(
                  mirrorRemovalSubtotal,
                )
                  ? Number(mirrorRemovalSubtotal)
                  : 0,
                sourceEstimateNumber: sourceEstimateNumber?.trim() || null,
                savedAt: now.toISOString(),
                savedBy: email,
              },
            },
          });

          return { createdEstimate, createdArtifact };
        });

        miscEstimate = saved.createdEstimate;
        artifact = saved.createdArtifact;
        break;
      } catch (error: any) {
        if (
          isEstimateNumberUniqueConstraintError(error) &&
          attempt < maxSaveAttempts
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!miscEstimate || !artifact || !estimateNumber) {
      throw new Error("Failed to save estimate");
    }

    return NextResponse.json({
      id: artifact.id,
      miscEstimateId: miscEstimate.id,
      estimateNumber,
      savedAt: artifact.createdAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save estimate" },
      { status: 500 },
    );
  }
}
