"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clipboard,
  Plus,
  Printer,
  RotateCcw,
  Save,
  X,
} from "lucide-react";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type CompanyInfo = {
  companyName: string;
  phoneNumber: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  logoUrl: string;
};

type JobOption = {
  id: string;
  dealId: string | null;
  dealName: string | null;
  address: string | null;
  status: string;
};

type ClientOption = {
  id: string;
  displayName: string;
  pipedriveId: string | null;
  contractor: string | null;
  customerAddress: string | null;
  jobs: JobOption[];
};

type LedStripRow = {
  id: string;
  roomId: string;
  linearFeet: string;
  ledTypeId: string;
  controlTypeId: string;
  profileId: string;
  profileQty: string;
};

type LedSheetRow = {
  id: string;
  roomId: string;
  width: string;
  height: string;
  sheetTypeId: string;
  controlTypeId: string;
};

type GlassDoorShelfRow = {
  id: string;
  width: string;
  height: string;
  glassTypeId: string;
  quantity: string;
  note: string;
};

type IslandPanelRow = {
  id: string;
  roomId: string;
  width: string;
  height: string;
  panelModelId: string;
};

type WallUnitRow = {
  id: string;
  roomId: string;
  width: string;
  height: string;
  note: string;
};

type MirrorFrameRow = {
  id: string;
  roomId: string;
  width: string;
  height: string;
  finishId: string;
  painted: "YES" | "NO";
  color: string;
};

type MirrorRow = {
  id: string;
  roomId: string;
  width: string;
  height: string;
  outlets: string;
  lightCutout: string;
  beveledOptionId: string;
  colorId: string;
  note: string;
};

type MirrorRemovalRow = {
  id: string;
  width: string;
  height: string;
  repairWall: "" | "YES" | "NO";
  note: string;
};

type RoomOption = {
  id: string;
  name: string;
  active: boolean;
};

type LedTypeOption = {
  id: string;
  name: string;
  minimumPriceUnder25Ft: number;
  pricePerFt: number;
  active: boolean;
};

type ControlTypeOption = {
  id: string;
  name: string;
  unitPrice: number;
  active: boolean;
};

type ProfileOption = {
  id: string;
  name: string;
  unitPrice: number;
  groovePricePerFt: number;
  active: boolean;
};

type SheetTypeOption = {
  id: string;
  name: string;
  minimumPrice: number;
  unitPrice: number;
  active: boolean;
};

type MirrorColorOption = {
  id: string;
  name: string;
  venda: number;
  custo: number;
  active: boolean;
};

type GlassDoorShelfTypeOption = {
  id: string;
  name: string;
  venda: number;
  custo: number;
  active: boolean;
};

type IslandPanelModelOption = {
  id: string;
  name: string;
  sfPerBox: number;
  cost: number;
  salesPrice: number;
  link: string | null;
  imageUrl: string | null;
  active: boolean;
};

type MirrorFrameFinishOption = {
  id: string;
  name: string;
  pricePerLinearFt: number;
  active: boolean;
};

type MirrorBevelOption = {
  id: string;
  name: string;
  venda: number;
  custo: number;
  active: boolean;
};

type MirrorSettingOption = {
  cuttingFee: number;
  outletCost: number;
  outletSale: number;
  lightCutoutCost: number;
  lightCutoutSale: number;
  outOfSquareBeveledCost: number;
  outOfSquareBeveledSale: number;
  removalPricePerSqFt: number;
  repairWallMultiplier: number;
};

type WallUnitSettingOption = {
  constructionPricePerSqFt: number;
};

type MirrorFrameSettingOption = {
  minimumCharge: number;
  paintingFactor: number;
};

type OptionKey =
  | "LED_STRIP"
  | "LED_SHEET"
  | "MIRROR"
  | "GLASS_DOOR_SHELF"
  | "ISLAND_PANEL"
  | "WALL_UNIT"
  | "MIRROR_FRAME";

const OPTION_LABELS: Array<{ key: OptionKey; label: string }> = [
  { key: "LED_STRIP", label: "LED Strip" },
  { key: "LED_SHEET", label: "LED Sheet" },
  { key: "MIRROR", label: "Mirror" },
  { key: "GLASS_DOOR_SHELF", label: "Glass Door/Shelf" },
  { key: "ISLAND_PANEL", label: "Island Panel" },
  { key: "WALL_UNIT", label: "Wall Unit" },
  { key: "MIRROR_FRAME", label: "Mirror Frame" },
];

function makeRow(index: number): LedStripRow {
  return {
    id: `row-${Date.now()}-${index}`,
    roomId: "",
    linearFeet: "",
    ledTypeId: "",
    controlTypeId: "",
    profileId: "",
    profileQty: "",
  };
}

function makeSheetRow(index: number): LedSheetRow {
  return {
    id: `sheet-row-${Date.now()}-${index}`,
    roomId: "",
    width: "",
    height: "",
    sheetTypeId: "",
    controlTypeId: "",
  };
}

function makeMirrorRow(index: number): MirrorRow {
  return {
    id: `mirror-row-${Date.now()}-${index}`,
    roomId: "",
    width: "",
    height: "",
    outlets: "",
    lightCutout: "",
    beveledOptionId: "",
    colorId: "",
    note: "",
  };
}

function makeGlassDoorShelfRow(index: number): GlassDoorShelfRow {
  return {
    id: `glass-door-shelf-row-${Date.now()}-${index}`,
    width: "",
    height: "",
    glassTypeId: "",
    quantity: "",
    note: "",
  };
}

function makeIslandPanelRow(index: number): IslandPanelRow {
  return {
    id: `island-panel-row-${Date.now()}-${index}`,
    roomId: "",
    width: "",
    height: "",
    panelModelId: "",
  };
}

function makeWallUnitRow(index: number): WallUnitRow {
  return {
    id: `wall-unit-row-${Date.now()}-${index}`,
    roomId: "",
    width: "",
    height: "",
    note: "",
  };
}

function makeMirrorFrameRow(index: number): MirrorFrameRow {
  return {
    id: `mirror-frame-row-${Date.now()}-${index}`,
    roomId: "",
    width: "",
    height: "",
    finishId: "",
    painted: "NO",
    color: "",
  };
}

function makeMirrorRemovalRow(index: number): MirrorRemovalRow {
  return {
    id: `mirror-removal-row-${Date.now()}-${index}`,
    width: "",
    height: "",
    repairWall: "",
    note: "",
  };
}

function autoGrowTextarea(target: HTMLTextAreaElement) {
  target.style.height = "auto";
  target.style.height = `${target.scrollHeight}px`;
}

function isChargeableMirrorBevelOption(
  option: { name?: string | null } | null | undefined,
) {
  const normalizedName = String(option?.name ?? "")
    .trim()
    .toLowerCase();
  return Boolean(normalizedName) && normalizedName !== "no";
}

interface Props {
  initialCompanyInfo: CompanyInfo;
  initialSalesRep: string;
}

type LoadedMetadata = {
  estimateNumber?: string;
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
  selectedOptions?: OptionKey[];
  ledStripRows?: Array<{
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
    profileQty?: number | null;
    subtotal?: number | null;
  }>;
  ledSheetRows?: Array<{
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
  }>;
  glassDoorShelfRows?: Array<{
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
  }>;
  islandPanelRows?: Array<{
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
  }>;
  wallUnitRows?: Array<{
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
  }>;
  mirrorFrameRows?: Array<{
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
  }>;
  mirrorRows?: Array<{
    roomId?: string | null;
    room?: string;
    width?: number | null;
    widthIn?: number | null;
    height?: number | null;
    heightIn?: number | null;
    squareFeet?: number | null;
    outlets?: number | null;
    lightCutout?: number | null;
    beveled?: boolean | string | null;
    beveledOptionId?: string | null;
    beveledOption?: string | null;
    colorId?: string | null;
    color?: string;
    note?: string | null;
    subtotal?: number | null;
  }>;
  mirrorRemovalRows?: Array<{
    width?: number | null;
    widthIn?: number | null;
    height?: number | null;
    heightIn?: number | null;
    squareFeet?: number | null;
    repairWall?: boolean | string | null;
    note?: string | null;
    subtotal?: number | null;
    repairWallSubtotal?: number | null;
    total?: number | null;
  }>;
  islandPanelSubtotal?: number | null;
  wallUnitSubtotal?: number | null;
  mirrorFrameSubtotal?: number | null;
};

function RollingCurrency({
  value,
  withDollarSign = false,
}: {
  value: number;
  withDollarSign?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [incomingValue, setIncomingValue] = useState<number | null>(null);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === displayValue) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setDirection(value > displayValue ? "up" : "down");
    setIncomingValue(value);

    timeoutRef.current = setTimeout(() => {
      setDisplayValue(value);
      setIncomingValue(null);
      timeoutRef.current = null;
    }, 320);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, displayValue]);

  const currentText = CURRENCY_FORMATTER.format(displayValue);
  const incomingText =
    incomingValue === null ? "" : CURRENCY_FORMATTER.format(incomingValue);
  const animationClass =
    incomingValue === null
      ? ""
      : direction === "up"
        ? "rolling-value--up"
        : "rolling-value--down";

  return (
    <span className="inline-flex items-center justify-end gap-0.5">
      {withDollarSign && <span>$</span>}
      <span className={`rolling-value ${animationClass}`}>
        <span className="rolling-value__line rolling-value__line--current">
          {currentText}
        </span>
        {incomingValue !== null && (
          <span className="rolling-value__line rolling-value__line--incoming">
            {incomingText}
          </span>
        )}
      </span>
    </span>
  );
}

export default function MiscEstimatesClient({
  initialCompanyInfo,
  initialSalesRep,
}: Props) {
  const interactiveFieldClass =
    "w-full rounded-sm border border-blue-200 bg-blue-50/60 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800";
  const interactiveCompactFieldClass =
    "w-24 rounded-sm border border-blue-200 bg-blue-50/60 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800";
  const interactiveTextareaClass =
    "w-full resize-none overflow-hidden rounded-sm border border-blue-200 bg-blue-50/60 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800";

  const searchParams = useSearchParams();
  const isReadOnlyMode = searchParams.get("mode")?.toLowerCase() === "view";
  const shouldAutoPrint = searchParams.get("autoprint") === "1";
  const autoPrintTriggeredRef = useRef(false);
  const [title, setTitle] = useState("Miscellaneous Estimate");
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [loadingClientSearch, setLoadingClientSearch] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(
    null,
  );
  const [selectedJobId, setSelectedJobId] = useState("");
  const [estimateNumber, setEstimateNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [salesRep, setSalesRep] = useState(initialSalesRep);
  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const [ledStripRows, setLedStripRows] = useState<LedStripRow[]>([
    makeRow(1),
    makeRow(2),
    makeRow(3),
  ]);
  const [ledSheetRows, setLedSheetRows] = useState<LedSheetRow[]>([
    makeSheetRow(1),
    makeSheetRow(2),
    makeSheetRow(3),
  ]);
  const [glassDoorShelfRows, setGlassDoorShelfRows] = useState<
    GlassDoorShelfRow[]
  >([
    makeGlassDoorShelfRow(1),
    makeGlassDoorShelfRow(2),
    makeGlassDoorShelfRow(3),
  ]);
  const [islandPanelRows, setIslandPanelRows] = useState<IslandPanelRow[]>([
    makeIslandPanelRow(1),
    makeIslandPanelRow(2),
    makeIslandPanelRow(3),
  ]);
  const [wallUnitRows, setWallUnitRows] = useState<WallUnitRow[]>([
    makeWallUnitRow(1),
    makeWallUnitRow(2),
    makeWallUnitRow(3),
  ]);
  const [mirrorFrameRows, setMirrorFrameRows] = useState<MirrorFrameRow[]>([
    makeMirrorFrameRow(1),
    makeMirrorFrameRow(2),
    makeMirrorFrameRow(3),
  ]);
  const [mirrorRows, setMirrorRows] = useState<MirrorRow[]>([
    makeMirrorRow(1),
    makeMirrorRow(2),
    makeMirrorRow(3),
  ]);
  const [mirrorRemovalRows, setMirrorRemovalRows] = useState<
    MirrorRemovalRow[]
  >([makeMirrorRemovalRow(1)]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [ledTypes, setLedTypes] = useState<LedTypeOption[]>([]);
  const [controlTypes, setControlTypes] = useState<ControlTypeOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [sheetTypes, setSheetTypes] = useState<SheetTypeOption[]>([]);
  const [mirrorColors, setMirrorColors] = useState<MirrorColorOption[]>([]);
  const [glassDoorShelfTypes, setGlassDoorShelfTypes] = useState<
    GlassDoorShelfTypeOption[]
  >([]);
  const [islandPanelModels, setIslandPanelModels] = useState<
    IslandPanelModelOption[]
  >([]);
  const [mirrorFrameFinishes, setMirrorFrameFinishes] = useState<
    MirrorFrameFinishOption[]
  >([]);
  const [mirrorBevelOptions, setMirrorBevelOptions] = useState<
    MirrorBevelOption[]
  >([]);
  const [mirrorSetting, setMirrorSetting] = useState<MirrorSettingOption>({
    cuttingFee: 0,
    outletCost: 0,
    outletSale: 0,
    lightCutoutCost: 0,
    lightCutoutSale: 0,
    outOfSquareBeveledCost: 0,
    outOfSquareBeveledSale: 0,
    removalPricePerSqFt: 0,
    repairWallMultiplier: 0.7,
  });
  const [wallUnitSetting, setWallUnitSetting] = useState<WallUnitSettingOption>(
    {
      constructionPricePerSqFt: 0,
    },
  );
  const [mirrorFrameSetting, setMirrorFrameSetting] =
    useState<MirrorFrameSettingOption>({
      minimumCharge: 0,
      paintingFactor: 1,
    });
  const [saveLoading, setSaveLoading] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  function copyToClipboard(text: string, section: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    });
  }

  function copyLedStrip() {
    const blocks = ledStripRows
      .filter((row) => row.roomId && row.ledTypeId)
      .map((row) =>
        [
          `Room: ${rooms.find((r) => r.id === row.roomId)?.name ?? ""}`,
          `Ln.Ft: ${row.linearFeet}`,
          `LED Type: ${ledTypes.find((t) => t.id === row.ledTypeId)?.name ?? ""}`,
          `Control Type: ${controlTypes.find((c) => c.id === row.controlTypeId)?.name ?? ""}`,
          `Profile: ${profiles.find((p) => p.id === row.profileId)?.name ?? "No"}`,
          `Profile Qty: ${getComputedProfileQty(row)}`,
        ].join("\n"),
      );
    copyToClipboard(
      ["LED STRIP", "", ...blocks.flatMap((b) => [b, ""])].join("\n").trimEnd(),
      "LED_STRIP",
    );
  }

  function copyLedSheet() {
    const blocks = ledSheetRows
      .filter((row) => row.roomId && row.sheetTypeId)
      .map((row) =>
        [
          `Room: ${rooms.find((r) => r.id === row.roomId)?.name ?? ""}`,
          `Width: ${row.width}`,
          `Height: ${row.height}`,
          `Sq.Ft: ${getLedSheetSquareFeet(row)}`,
          `Sheet Type: ${sheetTypes.find((s) => s.id === row.sheetTypeId)?.name ?? ""}`,
          `Control Type: ${controlTypes.find((c) => c.id === row.controlTypeId)?.name ?? ""}`,
        ].join("\n"),
      );
    copyToClipboard(
      ["LED SHEET", "", ...blocks.flatMap((b) => [b, ""])].join("\n").trimEnd(),
      "LED_SHEET",
    );
  }

  function copyMirror() {
    const mirrorBlocks = mirrorRows
      .filter((row) => row.roomId && row.colorId)
      .map((row) =>
        [
          `Room: ${rooms.find((r) => r.id === row.roomId)?.name ?? ""}`,
          `Width: ${row.width}`,
          `Height: ${row.height}`,
          `Outlets: ${row.outlets || "0"}`,
          `Light Cutout: ${row.lightCutout || "0"}`,
          `Beveled: ${mirrorBevelOptions.find((b) => b.id === row.beveledOptionId)?.name ?? ""}`,
          `Color: ${mirrorColors.find((c) => c.id === row.colorId)?.name ?? ""}`,
          `Note: ${row.note || ""}`,
        ].join("\n"),
      );

    const removalBlocks = mirrorRemovalRows
      .filter((row) => toNumber(row.width) > 0 && toNumber(row.height) > 0)
      .map((row) =>
        [
          `Width: ${row.width}`,
          `Height: ${row.height}`,
          `Sq.Ft: ${getMirrorRemovalSquareFeet(row).toFixed(2)}`,
          `Repair Wall: ${row.repairWall || "NO"}`,
          `Note: ${row.note || ""}`,
        ].join("\n"),
      );

    const text = [
      "MIRROR",
      "",
      ...mirrorBlocks.flatMap((item) => [item, ""]),
      ...(removalBlocks.length > 0
        ? ["MIRROR REMOVAL", "", ...removalBlocks.flatMap((item) => [item, ""])]
        : []),
    ]
      .join("\n")
      .trimEnd();

    copyToClipboard(text, "MIRROR");
  }

  function copyGlassDoorShelf() {
    const blocks = glassDoorShelfRows
      .filter((row) => row.glassTypeId && toNumber(row.quantity) > 0)
      .map((row) =>
        [
          `Width: ${row.width}`,
          `Height: ${row.height}`,
          `Sq.Ft: ${getGlassDoorShelfSquareFeet(row).toFixed(2)}`,
          `Glass Type: ${glassDoorShelfTypes.find((c) => c.id === row.glassTypeId)?.name ?? ""}`,
          `Quantity: ${row.quantity}`,
          `Note: ${row.note || ""}`,
        ].join("\n"),
      );

    copyToClipboard(
      ["GLASS DOOR/SHELF", "", ...blocks.flatMap((item) => [item, ""])]
        .join("\n")
        .trimEnd(),
      "GLASS_DOOR_SHELF",
    );
  }

  function copyIslandPanel() {
    const blocks = islandPanelRows
      .filter((row) => row.roomId && row.panelModelId)
      .map((row) => {
        const panel = islandPanelModelById.get(row.panelModelId);
        return [
          `Room: ${rooms.find((r) => r.id === row.roomId)?.name ?? ""}`,
          `Width: ${row.width}`,
          `Height: ${row.height}`,
          `Sq.Ft: ${Math.round(getIslandPanelSquareFeet(row))}`,
          `Panel Model: ${panel?.name ?? ""}`,
          `Box Qty: ${getIslandPanelBoxQty(row)}`,
        ].join("\n");
      });

    copyToClipboard(
      [
        "ISLAND / WALL DECORATIVE PANEL - Installation included",
        "",
        ...blocks.flatMap((item) => [item, ""]),
      ]
        .join("\n")
        .trimEnd(),
      "ISLAND_PANEL",
    );
  }

  function copyWallUnit() {
    const blocks = wallUnitRows
      .filter((row) => row.roomId)
      .map((row) =>
        [
          `Room: ${rooms.find((r) => r.id === row.roomId)?.name ?? ""}`,
          `Width: ${row.width}`,
          `Height: ${row.height}`,
          `Sq.Ft: ${Math.ceil(getWallUnitSquareFeet(row))}`,
          `Notes: ${row.note || ""}`,
        ].join("\n"),
      );

    copyToClipboard(
      ["WALL UNIT (Construction)", "", ...blocks.flatMap((item) => [item, ""])]
        .join("\n")
        .trimEnd(),
      "WALL_UNIT",
    );
  }

  function copyMirrorFrame() {
    const blocks = mirrorFrameRows
      .filter((row) => row.roomId && row.finishId)
      .map((row) =>
        [
          `Room: ${rooms.find((r) => r.id === row.roomId)?.name ?? ""}`,
          `Width: ${row.width}`,
          `Height: ${row.height}`,
          `Ln.In: ${getMirrorFrameLinearInches(row).toFixed(2)}`,
          `Type: ${mirrorFrameFinishById.get(row.finishId)?.name ?? ""}`,
          `Painted: ${row.painted}`,
          `Color: ${row.color || ""}`,
        ].join("\n"),
      );

    copyToClipboard(
      ["MIRROR FRAME - Labor Only", "", ...blocks.flatMap((item) => [item, ""])]
        .join("\n")
        .trimEnd(),
      "MIRROR_FRAME",
    );
  }

  function copyMirrorRemoval() {
    const removalBlocks = mirrorRemovalRows
      .filter((row) => toNumber(row.width) > 0 && toNumber(row.height) > 0)
      .map((row) =>
        [
          `Width: ${row.width}`,
          `Height: ${row.height}`,
          `Sq.Ft: ${getMirrorRemovalSquareFeet(row).toFixed(2)}`,
          `Repair Wall: ${row.repairWall || "NO"}`,
          `Mirror Removal: ${getMirrorRemovalSubtotal(row).toFixed(2)}`,
          `Repair Wall Subtotal: ${getMirrorRepairWallSubtotal(row).toFixed(2)}`,
          `Total: ${getMirrorRemovalTotal(row).toFixed(2)}`,
          `Note: ${row.note || ""}`,
        ].join("\n"),
      );

    const text = [
      "MIRROR REMOVAL",
      "",
      ...removalBlocks.flatMap((item) => [item, ""]),
    ]
      .join("\n")
      .trimEnd();

    copyToClipboard(text, "MIRROR_REMOVAL");
  }
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sourceEstimateNumber, setSourceEstimateNumber] = useState<
    string | null
  >(null);

  const clientInputRef = useRef<HTMLInputElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Recalculate dropdown position whenever results appear, and on scroll/resize
  useEffect(() => {
    if (clientResults.length === 0) {
      setDropdownRect(null);
      return;
    }
    function measure() {
      const rect = clientInputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDropdownRect({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [clientResults]);

  useEffect(() => {
    async function loadLedSettings() {
      try {
        const response = await fetch("/api/misc-estimates/settings/led");
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || "Failed to load LED settings");
        }

        setRooms(Array.isArray(json?.rooms) ? json.rooms : []);
        setLedTypes(Array.isArray(json?.ledTypes) ? json.ledTypes : []);
        setControlTypes(
          Array.isArray(json?.controlTypes) ? json.controlTypes : [],
        );
        setProfiles(Array.isArray(json?.profiles) ? json.profiles : []);
        setSheetTypes(Array.isArray(json?.sheetTypes) ? json.sheetTypes : []);
        setMirrorColors(
          Array.isArray(json?.mirrorColors) ? json.mirrorColors : [],
        );
        setGlassDoorShelfTypes(
          Array.isArray(json?.glassDoorShelfTypes)
            ? json.glassDoorShelfTypes
            : [],
        );
        setIslandPanelModels(
          Array.isArray(json?.islandPanelModels) ? json.islandPanelModels : [],
        );
        setMirrorFrameFinishes(
          Array.isArray(json?.mirrorFrameFinishes)
            ? json.mirrorFrameFinishes
            : [],
        );
        setMirrorBevelOptions(
          Array.isArray(json?.mirrorBevelOptions)
            ? json.mirrorBevelOptions
            : [],
        );
        setMirrorSetting({
          cuttingFee: toNumber(String(json?.mirrorSetting?.cuttingFee ?? 0)),
          outletCost: toNumber(String(json?.mirrorSetting?.outletCost ?? 0)),
          outletSale: toNumber(String(json?.mirrorSetting?.outletSale ?? 0)),
          lightCutoutCost: toNumber(
            String(json?.mirrorSetting?.lightCutoutCost ?? 0),
          ),
          lightCutoutSale: toNumber(
            String(json?.mirrorSetting?.lightCutoutSale ?? 0),
          ),
          outOfSquareBeveledCost: toNumber(
            String(json?.mirrorSetting?.outOfSquareBeveledCost ?? 0),
          ),
          outOfSquareBeveledSale: toNumber(
            String(json?.mirrorSetting?.outOfSquareBeveledSale ?? 0),
          ),
          removalPricePerSqFt: toNumber(
            String(json?.mirrorSetting?.removalPricePerSqFt ?? 0),
          ),
          repairWallMultiplier: toNumber(
            String(json?.mirrorSetting?.repairWallMultiplier ?? 0.7),
          ),
        });
        setWallUnitSetting({
          constructionPricePerSqFt: toNumber(
            String(json?.wallUnitSetting?.constructionPricePerSqFt ?? 0),
          ),
        });
        setMirrorFrameSetting({
          minimumCharge: toNumber(
            String(json?.mirrorFrameSetting?.minimumCharge ?? 0),
          ),
          paintingFactor:
            toNumber(String(json?.mirrorFrameSetting?.paintingFactor ?? 1)) ||
            1,
        });
      } catch (error: any) {
        setSaveError(error?.message || "Failed to load LED settings");
      }
    }

    void loadLedSettings();
  }, []);

  const selectedJob = useMemo(
    () => selectedClient?.jobs.find((j) => j.id === selectedJobId) ?? null,
    [selectedClient, selectedJobId],
  );

  const inferredContractor = selectedClient?.contractor?.trim() || null;

  const ledTypeById = useMemo(
    () => new Map(ledTypes.map((item) => [item.id, item])),
    [ledTypes],
  );
  const controlTypeById = useMemo(
    () => new Map(controlTypes.map((item) => [item.id, item])),
    [controlTypes],
  );
  const profileById = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles],
  );
  const sheetTypeById = useMemo(
    () => new Map(sheetTypes.map((item) => [item.id, item])),
    [sheetTypes],
  );
  const mirrorColorById = useMemo(
    () => new Map(mirrorColors.map((item) => [item.id, item])),
    [mirrorColors],
  );
  const glassDoorShelfTypeById = useMemo(
    () => new Map(glassDoorShelfTypes.map((item) => [item.id, item])),
    [glassDoorShelfTypes],
  );
  const islandPanelModelById = useMemo(
    () => new Map(islandPanelModels.map((item) => [item.id, item])),
    [islandPanelModels],
  );
  const mirrorFrameFinishById = useMemo(
    () => new Map(mirrorFrameFinishes.map((item) => [item.id, item])),
    [mirrorFrameFinishes],
  );
  const mirrorBevelById = useMemo(
    () => new Map(mirrorBevelOptions.map((item) => [item.id, item])),
    [mirrorBevelOptions],
  );

  const roomNameToId = useMemo(
    () =>
      new Map(rooms.map((item) => [item.name.trim().toLowerCase(), item.id])),
    [rooms],
  );
  const ledTypeNameToId = useMemo(
    () =>
      new Map(
        ledTypes.map((item) => [item.name.trim().toLowerCase(), item.id]),
      ),
    [ledTypes],
  );
  const controlNameToId = useMemo(
    () =>
      new Map(
        controlTypes.map((item) => [item.name.trim().toLowerCase(), item.id]),
      ),
    [controlTypes],
  );
  const profileNameToId = useMemo(
    () =>
      new Map(
        profiles.map((item) => [item.name.trim().toLowerCase(), item.id]),
      ),
    [profiles],
  );
  const sheetTypeNameToId = useMemo(
    () =>
      new Map(
        sheetTypes.map((item) => [item.name.trim().toLowerCase(), item.id]),
      ),
    [sheetTypes],
  );
  const mirrorColorNameToId = useMemo(
    () =>
      new Map(
        mirrorColors.map((item) => [item.name.trim().toLowerCase(), item.id]),
      ),
    [mirrorColors],
  );
  const glassDoorShelfTypeNameToId = useMemo(
    () =>
      new Map(
        glassDoorShelfTypes.map((item) => [
          item.name.trim().toLowerCase(),
          item.id,
        ]),
      ),
    [glassDoorShelfTypes],
  );
  const islandPanelModelNameToId = useMemo(
    () =>
      new Map(
        islandPanelModels.map((item) => [
          item.name.trim().toLowerCase(),
          item.id,
        ]),
      ),
    [islandPanelModels],
  );
  const mirrorFrameFinishNameToId = useMemo(
    () =>
      new Map(
        mirrorFrameFinishes.map((item) => [
          item.name.trim().toLowerCase(),
          item.id,
        ]),
      ),
    [mirrorFrameFinishes],
  );
  const mirrorBevelNameToId = useMemo(
    () =>
      new Map(
        mirrorBevelOptions.map((item) => [
          item.name.trim().toLowerCase(),
          item.id,
        ]),
      ),
    [mirrorBevelOptions],
  );

  function toNumber(value: string) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isProfileYes(row: LedStripRow) {
    const selectedName = profileById
      .get(row.profileId)
      ?.name?.trim()
      .toLowerCase();
    return selectedName === "yes";
  }

  function getComputedProfileQty(row: LedStripRow) {
    const linearFeet = toNumber(row.linearFeet);
    if (!isProfileYes(row) || linearFeet <= 0) {
      return 0;
    }
    return Math.ceil(linearFeet / 8);
  }

  function getRowSubtotal(row: LedStripRow) {
    const linearFeet = toNumber(row.linearFeet);
    const profileQty = getComputedProfileQty(row);
    const profileEnabled = isProfileYes(row);
    const minimumTypePrice =
      ledTypeById.get(row.ledTypeId)?.minimumPriceUnder25Ft || 0;
    const typePrice = ledTypeById.get(row.ledTypeId)?.pricePerFt || 0;
    const groovePricePerFt =
      profileById.get(row.profileId)?.groovePricePerFt || 0;
    const profilePrice = profileById.get(row.profileId)?.unitPrice || 0;
    const ledBasePrice =
      linearFeet <= 0
        ? 0
        : linearFeet <= 25
          ? minimumTypePrice
          : minimumTypePrice + (linearFeet - 25) * typePrice;
    const profileAndGrooveCharge = profileEnabled
      ? profileQty * profilePrice + linearFeet * groovePricePerFt
      : 0;
    return ledBasePrice + profileAndGrooveCharge;
  }

  const ledStripSubtotal = useMemo(
    () => ledStripRows.reduce((sum, row) => sum + getRowSubtotal(row), 0),
    [ledStripRows, ledTypeById, controlTypeById, profileById],
  );

  function getLedSheetSquareFeet(row: LedSheetRow) {
    const width = toNumber(row.width);
    const height = toNumber(row.height);
    if (width <= 0 || height <= 0) {
      return 0;
    }
    return Math.ceil((width * height) / 144);
  }

  function getLedSheetRowSubtotal(row: LedSheetRow) {
    const squareFeet = getLedSheetSquareFeet(row);
    const sheetType = sheetTypeById.get(row.sheetTypeId);
    if (squareFeet <= 0 || !sheetType) {
      return 0;
    }
    const sheetPrice = (sheetType.unitPrice || 0) * squareFeet;
    return Math.max(sheetType.minimumPrice || 0, sheetPrice);
  }

  const ledSheetSubtotal = useMemo(
    () =>
      ledSheetRows.reduce((sum, row) => sum + getLedSheetRowSubtotal(row), 0),
    [ledSheetRows, sheetTypeById],
  );

  function getGlassDoorShelfSquareFeet(row: GlassDoorShelfRow) {
    const width = toNumber(row.width);
    const height = toNumber(row.height);
    if (width <= 0 || height <= 0) {
      return 0;
    }
    return (width * height) / 144;
  }

  function getGlassDoorShelfRowSubtotal(row: GlassDoorShelfRow) {
    const glassType = glassDoorShelfTypeById.get(row.glassTypeId);
    if (!glassType) {
      return 0;
    }

    const squareFeet = getGlassDoorShelfSquareFeet(row);
    const quantity = Math.max(0, toNumber(row.quantity));
    if (squareFeet <= 0 || quantity <= 0) {
      return 0;
    }

    const glassUnitSale = toNumber(String(glassType.venda));
    const cuttingFee = toNumber(String(mirrorSetting.cuttingFee));

    return squareFeet * glassUnitSale * quantity + cuttingFee * quantity;
  }

  const glassDoorShelfSubtotal = useMemo(
    () =>
      glassDoorShelfRows.reduce(
        (sum, row) => sum + getGlassDoorShelfRowSubtotal(row),
        0,
      ),
    [glassDoorShelfRows, glassDoorShelfTypeById, mirrorSetting],
  );

  function calculateSqFt(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      return 0;
    }
    return (width * height) / 144;
  }

  function calculateIslandPanelBoxQty(sqft: number, sfPerBox: number) {
    if (sqft <= 0 || sfPerBox <= 0) {
      return 0;
    }
    return Math.ceil(sqft / sfPerBox);
  }

  function calculateIslandPanelSubtotal(
    sqft: number,
    panel: IslandPanelModelOption | undefined,
  ) {
    if (!panel) {
      return 0;
    }
    const boxQty = calculateIslandPanelBoxQty(
      sqft,
      toNumber(String(panel.sfPerBox)),
    );
    return toNumber(String(panel.salesPrice)) * boxQty;
  }

  function calculateWallUnitSubtotal(sqft: number, constructionPrice: number) {
    return sqft > 0 ? sqft * constructionPrice : 0;
  }

  function calculateMirrorFrameLinearInches(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      return 0;
    }
    return (width + height) * 2;
  }

  function calculateMirrorFrameSubtotal(
    linearInches: number,
    finish: MirrorFrameFinishOption | undefined,
    minimumCharge: number,
    painted: "YES" | "NO",
    paintingFactor: number,
  ) {
    if (linearInches <= 0 || !finish) {
      return 0;
    }

    const base = Math.max(
      linearInches * toNumber(String(finish.pricePerLinearFt)),
      minimumCharge,
    );

    return painted === "YES" ? base * paintingFactor : base;
  }

  function getIslandPanelSquareFeet(row: IslandPanelRow) {
    return calculateSqFt(toNumber(row.width), toNumber(row.height));
  }

  function getIslandPanelBoxQty(row: IslandPanelRow) {
    const panel = islandPanelModelById.get(row.panelModelId);
    return calculateIslandPanelBoxQty(
      getIslandPanelSquareFeet(row),
      toNumber(String(panel?.sfPerBox ?? 0)),
    );
  }

  function getIslandPanelRowSubtotal(row: IslandPanelRow) {
    const panel = islandPanelModelById.get(row.panelModelId);
    return calculateIslandPanelSubtotal(getIslandPanelSquareFeet(row), panel);
  }

  const islandPanelSubtotal = useMemo(
    () =>
      islandPanelRows.reduce(
        (sum, row) => sum + getIslandPanelRowSubtotal(row),
        0,
      ),
    [islandPanelRows, islandPanelModelById],
  );

  function getWallUnitSquareFeet(row: WallUnitRow) {
    return calculateSqFt(toNumber(row.width), toNumber(row.height));
  }

  function getWallUnitRowSubtotal(row: WallUnitRow) {
    return calculateWallUnitSubtotal(
      Math.ceil(getWallUnitSquareFeet(row)),
      wallUnitSetting.constructionPricePerSqFt,
    );
  }

  const wallUnitSubtotal = useMemo(
    () =>
      wallUnitRows.reduce((sum, row) => sum + getWallUnitRowSubtotal(row), 0),
    [wallUnitRows, wallUnitSetting],
  );

  function getMirrorFrameLinearInches(row: MirrorFrameRow) {
    return calculateMirrorFrameLinearInches(
      toNumber(row.width),
      toNumber(row.height),
    );
  }

  function getMirrorFrameRowSubtotal(row: MirrorFrameRow) {
    return calculateMirrorFrameSubtotal(
      getMirrorFrameLinearInches(row),
      mirrorFrameFinishById.get(row.finishId),
      mirrorFrameSetting.minimumCharge,
      row.painted,
      mirrorFrameSetting.paintingFactor,
    );
  }

  const mirrorFrameSubtotal = useMemo(
    () =>
      mirrorFrameRows.reduce(
        (sum, row) => sum + getMirrorFrameRowSubtotal(row),
        0,
      ),
    [mirrorFrameRows, mirrorFrameFinishById, mirrorFrameSetting],
  );

  function getMirrorSquareFeet(row: MirrorRow) {
    const width = toNumber(row.width);
    const height = toNumber(row.height);
    if (width <= 0 || height <= 0) {
      return 0;
    }
    return (width * height) / 144;
  }

  function getMirrorRowSubtotal(row: MirrorRow) {
    const color = mirrorColorById.get(row.colorId);
    const bevelOption = mirrorBevelById.get(row.beveledOptionId);
    if (!color) {
      return 0;
    }

    const squareFeet = getMirrorSquareFeet(row);
    const outlets = Math.max(0, Math.floor(toNumber(row.outlets)));
    const lightCutout = Math.max(0, Math.floor(toNumber(row.lightCutout)));
    const isBeveled = isChargeableMirrorBevelOption(bevelOption);
    const width = toNumber(row.width);
    const height = toNumber(row.height);
    const perimeter = width > 0 && height > 0 ? width * 2 + height * 2 : 0;

    const base = squareFeet * toNumber(String(color.venda));
    const outletCharge = outlets * mirrorSetting.outletSale;
    const lightCutoutCharge = lightCutout * mirrorSetting.lightCutoutSale;
    const beveledPerInchCharge = isBeveled
      ? perimeter * (bevelOption?.venda || 0)
      : 0;
    const outOfSquareCharge = isBeveled
      ? mirrorSetting.outOfSquareBeveledSale
      : 0;

    return (
      base +
      outletCharge +
      lightCutoutCharge +
      beveledPerInchCharge +
      outOfSquareCharge
    );
  }

  const mirrorSubtotal = useMemo(
    () => mirrorRows.reduce((sum, row) => sum + getMirrorRowSubtotal(row), 0),
    [mirrorRows, mirrorColorById, mirrorBevelById, mirrorSetting],
  );

  function getMirrorRemovalSquareFeet(row: MirrorRemovalRow) {
    const width = toNumber(row.width);
    const height = toNumber(row.height);
    if (width <= 0 || height <= 0) {
      return 0;
    }
    return (width * height) / 144;
  }

  function getMirrorRemovalSubtotal(row: MirrorRemovalRow) {
    const squareFeet = getMirrorRemovalSquareFeet(row);
    return squareFeet * mirrorSetting.removalPricePerSqFt;
  }

  function getMirrorRepairWallSubtotal(row: MirrorRemovalRow) {
    if (row.repairWall !== "YES") {
      return 0;
    }
    return getMirrorRemovalSubtotal(row) * mirrorSetting.repairWallMultiplier;
  }

  function getMirrorRemovalTotal(row: MirrorRemovalRow) {
    return getMirrorRemovalSubtotal(row) + getMirrorRepairWallSubtotal(row);
  }

  const mirrorRemovalSubtotal = useMemo(
    () =>
      mirrorRemovalRows.reduce(
        (sum, row) => sum + getMirrorRemovalTotal(row),
        0,
      ),
    [mirrorRemovalRows, mirrorSetting],
  );

  const estimateTotal =
    ledStripSubtotal +
    ledSheetSubtotal +
    glassDoorShelfSubtotal +
    islandPanelSubtotal +
    wallUnitSubtotal +
    mirrorFrameSubtotal +
    mirrorSubtotal +
    mirrorRemovalSubtotal;

  async function searchClients(input: string) {
    setClientSearch(input);
    setSaveError(null);

    if (input.trim().length < 2) {
      setClientResults([]);
      return;
    }

    setLoadingClientSearch(true);
    try {
      const response = await fetch(
        `/api/misc-estimates/lookup?q=${encodeURIComponent(input)}`,
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Failed to lookup clients");
      }
      setClientResults(Array.isArray(json.results) ? json.results : []);
    } catch (error: any) {
      setSaveError(error?.message || "Failed to lookup clients");
    } finally {
      setLoadingClientSearch(false);
    }
  }

  function handlePickClient(client: ClientOption) {
    setSelectedClient(client);
    setClientSearch(client.displayName);
    const firstJob = client.jobs[0];
    setSelectedJobId(firstJob?.id || "");
    setClientResults([]);
  }

  function toggleOption(option: OptionKey) {
    setSelectedOptions((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option],
    );
  }

  function updateLedStripRow(id: string, patch: Partial<LedStripRow>) {
    setLedStripRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addLedStripRow() {
    setLedStripRows((prev) => [...prev, makeRow(prev.length + 1)]);
  }

  function removeLedStripRow(id: string) {
    setLedStripRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  function updateLedSheetRow(id: string, patch: Partial<LedSheetRow>) {
    setLedSheetRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addLedSheetRow() {
    setLedSheetRows((prev) => [...prev, makeSheetRow(prev.length + 1)]);
  }

  function removeLedSheetRow(id: string) {
    setLedSheetRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  function updateMirrorRow(id: string, patch: Partial<MirrorRow>) {
    setMirrorRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addMirrorRow() {
    setMirrorRows((prev) => [...prev, makeMirrorRow(prev.length + 1)]);
  }

  function removeMirrorRow(id: string) {
    setMirrorRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  function updateGlassDoorShelfRow(
    id: string,
    patch: Partial<GlassDoorShelfRow>,
  ) {
    setGlassDoorShelfRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addGlassDoorShelfRow() {
    setGlassDoorShelfRows((prev) => [
      ...prev,
      makeGlassDoorShelfRow(prev.length + 1),
    ]);
  }

  function removeGlassDoorShelfRow(id: string) {
    setGlassDoorShelfRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  function updateIslandPanelRow(id: string, patch: Partial<IslandPanelRow>) {
    setIslandPanelRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addIslandPanelRow() {
    setIslandPanelRows((prev) => [
      ...prev,
      makeIslandPanelRow(prev.length + 1),
    ]);
  }

  function removeIslandPanelRow(id: string) {
    setIslandPanelRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  function updateWallUnitRow(id: string, patch: Partial<WallUnitRow>) {
    setWallUnitRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addWallUnitRow() {
    setWallUnitRows((prev) => [...prev, makeWallUnitRow(prev.length + 1)]);
  }

  function removeWallUnitRow(id: string) {
    setWallUnitRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  function updateMirrorFrameRow(id: string, patch: Partial<MirrorFrameRow>) {
    setMirrorFrameRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addMirrorFrameRow() {
    setMirrorFrameRows((prev) => [
      ...prev,
      makeMirrorFrameRow(prev.length + 1),
    ]);
  }

  function removeMirrorFrameRow(id: string) {
    setMirrorFrameRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  function updateMirrorRemovalRow(
    id: string,
    patch: Partial<MirrorRemovalRow>,
  ) {
    setMirrorRemovalRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addMirrorRemovalRow() {
    setMirrorRemovalRows((prev) => [
      ...prev,
      makeMirrorRemovalRow(prev.length + 1),
    ]);
  }

  function removeMirrorRemovalRow(id: string) {
    setMirrorRemovalRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  useEffect(() => {
    const rawEstimateId = searchParams.get("estimateId");
    if (!rawEstimateId) return;
    const estimateId = rawEstimateId.trim();
    if (!estimateId) return;

    async function loadEstimate() {
      setSaveMessage(null);
      setSaveError(null);
      try {
        const response = await fetch(
          `/api/misc-estimates/${encodeURIComponent(estimateId)}`,
        );
        let json = await response.json();
        if (!response.ok) {
          const fallbackResponse = await fetch(
            `/api/misc-estimates?id=${encodeURIComponent(estimateId)}`,
          );
          json = await fallbackResponse.json();
          if (!fallbackResponse.ok) {
            throw new Error(json?.error || "Failed to load estimate");
          }
        }

        const meta = (json?.metadata ?? {}) as LoadedMetadata;
        const loadedJobId = meta.jobId ?? "";
        const loadedDealName = meta.dealName ?? null;
        const loadedDealId = meta.dealId ?? null;

        setTitle(meta.title || "Miscellaneous Estimate");
        setEstimateNumber(meta.estimateNumber || "");
        setDate(meta.date || new Date().toISOString().slice(0, 10));
        setSalesRep(meta.salesRep || initialSalesRep);
        setSelectedOptions(
          Array.isArray(meta.selectedOptions) ? meta.selectedOptions : [],
        );

        const mappedRows = Array.isArray(meta.ledStripRows)
          ? meta.ledStripRows.map((row, index) => ({
              id: `loaded-${index}-${Date.now()}`,
              roomId:
                row.roomId ||
                (row.room
                  ? roomNameToId.get(row.room.trim().toLowerCase()) || ""
                  : ""),
              linearFeet:
                typeof (row.linearFeet ?? row.lnFt) === "number" &&
                Number.isFinite(row.linearFeet ?? row.lnFt)
                  ? String(row.linearFeet ?? row.lnFt)
                  : "",
              ledTypeId:
                row.ledTypeId ||
                (row.ledType
                  ? ledTypeNameToId.get(row.ledType.trim().toLowerCase()) || ""
                  : ""),
              controlTypeId:
                row.controlTypeId ||
                (row.controlType
                  ? controlNameToId.get(row.controlType.trim().toLowerCase()) ||
                    ""
                  : ""),
              profileId:
                row.profileId ||
                (row.profile
                  ? profileNameToId.get(row.profile.trim().toLowerCase()) || ""
                  : ""),
              profileQty:
                typeof row.profileQty === "number" &&
                Number.isFinite(row.profileQty)
                  ? String(row.profileQty)
                  : "",
            }))
          : [];
        setLedStripRows(
          mappedRows.length > 0
            ? mappedRows
            : [makeRow(1), makeRow(2), makeRow(3)],
        );

        const mappedSheetRows = Array.isArray(meta.ledSheetRows)
          ? meta.ledSheetRows.map((row, index) => ({
              id: `loaded-sheet-${index}-${Date.now()}`,
              roomId:
                row.roomId ||
                (row.room
                  ? roomNameToId.get(row.room.trim().toLowerCase()) || ""
                  : ""),
              width:
                typeof (row.width ?? row.widthIn) === "number" &&
                Number.isFinite(row.width ?? row.widthIn)
                  ? String(row.width ?? row.widthIn)
                  : "",
              height:
                typeof (row.height ?? row.heightIn) === "number" &&
                Number.isFinite(row.height ?? row.heightIn)
                  ? String(row.height ?? row.heightIn)
                  : "",
              sheetTypeId:
                row.sheetTypeId ||
                (row.sheetType
                  ? sheetTypeNameToId.get(row.sheetType.trim().toLowerCase()) ||
                    ""
                  : ""),
              controlTypeId:
                row.controlTypeId ||
                (row.controlType
                  ? controlNameToId.get(row.controlType.trim().toLowerCase()) ||
                    ""
                  : ""),
            }))
          : [];
        setLedSheetRows(
          mappedSheetRows.length > 0
            ? mappedSheetRows
            : [makeSheetRow(1), makeSheetRow(2), makeSheetRow(3)],
        );

        const mappedGlassDoorShelfRows = Array.isArray(meta.glassDoorShelfRows)
          ? meta.glassDoorShelfRows.map((row, index) => ({
              id: `loaded-glass-door-shelf-${index}-${Date.now()}`,
              width:
                typeof (row.width ?? row.widthIn) === "number" &&
                Number.isFinite(row.width ?? row.widthIn)
                  ? String(row.width ?? row.widthIn)
                  : "",
              height:
                typeof (row.height ?? row.heightIn) === "number" &&
                Number.isFinite(row.height ?? row.heightIn)
                  ? String(row.height ?? row.heightIn)
                  : "",
              glassTypeId:
                row.glassTypeId ||
                (row.glassType
                  ? glassDoorShelfTypeNameToId.get(
                      row.glassType.trim().toLowerCase(),
                    ) || ""
                  : ""),
              quantity:
                typeof row.quantity === "number" &&
                Number.isFinite(row.quantity)
                  ? String(row.quantity)
                  : "",
              note: row.note || "",
            }))
          : [];
        setGlassDoorShelfRows(
          mappedGlassDoorShelfRows.length > 0
            ? mappedGlassDoorShelfRows
            : [
                makeGlassDoorShelfRow(1),
                makeGlassDoorShelfRow(2),
                makeGlassDoorShelfRow(3),
              ],
        );

        const mappedIslandPanelRows = Array.isArray(meta.islandPanelRows)
          ? meta.islandPanelRows.map((row, index) => ({
              id: `loaded-island-panel-${index}-${Date.now()}`,
              roomId:
                row.roomId ||
                (row.room
                  ? roomNameToId.get(row.room.trim().toLowerCase()) || ""
                  : ""),
              width:
                typeof (row.width ?? row.widthIn) === "number" &&
                Number.isFinite(row.width ?? row.widthIn)
                  ? String(row.width ?? row.widthIn)
                  : "",
              height:
                typeof (row.height ?? row.heightIn) === "number" &&
                Number.isFinite(row.height ?? row.heightIn)
                  ? String(row.height ?? row.heightIn)
                  : "",
              panelModelId:
                row.panelModelId ||
                (row.panelModel
                  ? islandPanelModelNameToId.get(
                      row.panelModel.trim().toLowerCase(),
                    ) || ""
                  : ""),
            }))
          : [];
        setIslandPanelRows(
          mappedIslandPanelRows.length > 0
            ? mappedIslandPanelRows
            : [
                makeIslandPanelRow(1),
                makeIslandPanelRow(2),
                makeIslandPanelRow(3),
              ],
        );

        const mappedWallUnitRows = Array.isArray(meta.wallUnitRows)
          ? meta.wallUnitRows.map((row, index) => ({
              id: `loaded-wall-unit-${index}-${Date.now()}`,
              roomId:
                row.roomId ||
                (row.room
                  ? roomNameToId.get(row.room.trim().toLowerCase()) || ""
                  : ""),
              width:
                typeof (row.width ?? row.widthIn) === "number" &&
                Number.isFinite(row.width ?? row.widthIn)
                  ? String(row.width ?? row.widthIn)
                  : "",
              height:
                typeof (row.height ?? row.heightIn) === "number" &&
                Number.isFinite(row.height ?? row.heightIn)
                  ? String(row.height ?? row.heightIn)
                  : "",
              note: row.note || "",
            }))
          : [];
        setWallUnitRows(
          mappedWallUnitRows.length > 0
            ? mappedWallUnitRows
            : [makeWallUnitRow(1), makeWallUnitRow(2), makeWallUnitRow(3)],
        );

        const mappedMirrorFrameRows = Array.isArray(meta.mirrorFrameRows)
          ? meta.mirrorFrameRows.map((row, index) => ({
              id: `loaded-mirror-frame-${index}-${Date.now()}`,
              roomId:
                row.roomId ||
                (row.room
                  ? roomNameToId.get(row.room.trim().toLowerCase()) || ""
                  : ""),
              width:
                typeof (row.width ?? row.widthIn) === "number" &&
                Number.isFinite(row.width ?? row.widthIn)
                  ? String(row.width ?? row.widthIn)
                  : "",
              height:
                typeof (row.height ?? row.heightIn) === "number" &&
                Number.isFinite(row.height ?? row.heightIn)
                  ? String(row.height ?? row.heightIn)
                  : "",
              finishId:
                row.finishId ||
                (row.finish
                  ? mirrorFrameFinishNameToId.get(
                      row.finish.trim().toLowerCase(),
                    ) || ""
                  : ""),
              painted:
                row.painted === true ||
                String(row.painted || "")
                  .trim()
                  .toLowerCase() === "yes"
                  ? ("YES" as const)
                  : ("NO" as const),
              color: row.color || "",
            }))
          : [];
        setMirrorFrameRows(
          mappedMirrorFrameRows.length > 0
            ? mappedMirrorFrameRows
            : [
                makeMirrorFrameRow(1),
                makeMirrorFrameRow(2),
                makeMirrorFrameRow(3),
              ],
        );

        const mappedMirrorRows = Array.isArray(meta.mirrorRows)
          ? meta.mirrorRows.map((row, index) => {
              const beveledOptionId =
                row.beveledOptionId ||
                (row.beveledOption
                  ? mirrorBevelNameToId.get(
                      row.beveledOption.trim().toLowerCase(),
                    ) || ""
                  : row.beveled === true
                    ? mirrorBevelOptions[0]?.id || ""
                    : "");

              return {
                id: `loaded-mirror-${index}-${Date.now()}`,
                roomId:
                  row.roomId ||
                  (row.room
                    ? roomNameToId.get(row.room.trim().toLowerCase()) || ""
                    : ""),
                width:
                  typeof (row.width ?? row.widthIn) === "number" &&
                  Number.isFinite(row.width ?? row.widthIn)
                    ? String(row.width ?? row.widthIn)
                    : "",
                height:
                  typeof (row.height ?? row.heightIn) === "number" &&
                  Number.isFinite(row.height ?? row.heightIn)
                    ? String(row.height ?? row.heightIn)
                    : "",
                outlets:
                  typeof row.outlets === "number" &&
                  Number.isFinite(row.outlets)
                    ? String(row.outlets)
                    : "",
                lightCutout:
                  typeof row.lightCutout === "number" &&
                  Number.isFinite(row.lightCutout)
                    ? String(row.lightCutout)
                    : "",
                beveledOptionId,
                colorId:
                  row.colorId ||
                  (row.color
                    ? mirrorColorNameToId.get(row.color.trim().toLowerCase()) ||
                      ""
                    : ""),
                note: row.note || "",
              };
            })
          : [];
        setMirrorRows(
          mappedMirrorRows.length > 0
            ? mappedMirrorRows
            : [makeMirrorRow(1), makeMirrorRow(2), makeMirrorRow(3)],
        );

        const mappedMirrorRemovalRows = Array.isArray(meta.mirrorRemovalRows)
          ? meta.mirrorRemovalRows.map((row, index) => {
              let repairWall: "" | "YES" | "NO" = "";
              if (
                row.repairWall === true ||
                String(row.repairWall || "")
                  .trim()
                  .toLowerCase() === "yes"
              ) {
                repairWall = "YES";
              } else if (row.repairWall === false) {
                repairWall = "NO";
              }

              return {
                id: `loaded-mirror-removal-${index}-${Date.now()}`,
                width:
                  typeof (row.width ?? row.widthIn) === "number" &&
                  Number.isFinite(row.width ?? row.widthIn)
                    ? String(row.width ?? row.widthIn)
                    : "",
                height:
                  typeof (row.height ?? row.heightIn) === "number" &&
                  Number.isFinite(row.height ?? row.heightIn)
                    ? String(row.height ?? row.heightIn)
                    : "",
                repairWall,
                note: row.note || "",
              };
            })
          : [];
        setMirrorRemovalRows(
          mappedMirrorRemovalRows.length > 0
            ? mappedMirrorRemovalRows
            : [makeMirrorRemovalRow(1)],
        );

        const selected: ClientOption = {
          id: meta.customerId || "",
          displayName: meta.customerName || "-",
          pipedriveId: meta.customerPipedriveId || null,
          contractor: meta.contractor || null,
          customerAddress: meta.address || null,
          jobs: [
            {
              id: loadedJobId,
              dealId: loadedDealId,
              dealName: loadedDealName,
              address: meta.address || null,
              status: "LOADED",
            },
          ].filter((job) => Boolean(job.id)),
        };

        if (selected.id) {
          setSelectedClient(selected);
          setClientSearch(selected.displayName);
          setSelectedJobId(loadedJobId);
        }

        const mode = searchParams.get("mode")?.toLowerCase();
        setSourceEstimateNumber(
          mode === "edit" ? meta.estimateNumber?.trim() || null : null,
        );
        setSaveMessage(
          mode === "edit"
            ? `Loaded ${meta.estimateNumber || "estimate"} as editable copy.`
            : `Loaded ${meta.estimateNumber || "saved estimate"}.`,
        );

        if (shouldAutoPrint && !autoPrintTriggeredRef.current) {
          autoPrintTriggeredRef.current = true;
          window.setTimeout(() => window.print(), 300);
        }
      } catch (error: any) {
        setSaveError(error?.message || "Failed to load estimate");
      }
    }

    void loadEstimate();
  }, [
    initialSalesRep,
    searchParams,
    roomNameToId,
    ledTypeNameToId,
    controlNameToId,
    profileNameToId,
    sheetTypeNameToId,
    mirrorColorNameToId,
    glassDoorShelfTypeNameToId,
    islandPanelModelNameToId,
    mirrorFrameFinishNameToId,
    mirrorBevelNameToId,
    mirrorBevelOptions,
    shouldAutoPrint,
  ]);

  function handlePrint() {
    window.print();
  }

  function handleReset() {
    const shouldReset = window.confirm(
      "Reset this estimate? All unsaved changes will be lost.",
    );
    if (!shouldReset) return;

    setTitle("Miscellaneous Estimate");
    setClientSearch("");
    setClientResults([]);
    setSelectedClient(null);
    setSelectedJobId("");
    setEstimateNumber("");
    setDate(new Date().toISOString().slice(0, 10));
    setSalesRep(initialSalesRep);
    setSelectedOptions([]);
    setLedStripRows([makeRow(1), makeRow(2), makeRow(3)]);
    setLedSheetRows([makeSheetRow(1), makeSheetRow(2), makeSheetRow(3)]);
    setGlassDoorShelfRows([
      makeGlassDoorShelfRow(1),
      makeGlassDoorShelfRow(2),
      makeGlassDoorShelfRow(3),
    ]);
    setIslandPanelRows([
      makeIslandPanelRow(1),
      makeIslandPanelRow(2),
      makeIslandPanelRow(3),
    ]);
    setWallUnitRows([
      makeWallUnitRow(1),
      makeWallUnitRow(2),
      makeWallUnitRow(3),
    ]);
    setMirrorFrameRows([
      makeMirrorFrameRow(1),
      makeMirrorFrameRow(2),
      makeMirrorFrameRow(3),
    ]);
    setMirrorRows([makeMirrorRow(1), makeMirrorRow(2), makeMirrorRow(3)]);
    setMirrorRemovalRows([makeMirrorRemovalRow(1)]);
    setSourceEstimateNumber(null);
    setSaveMessage(null);
    setSaveError(null);
  }

  async function saveEstimate() {
    setSaveMessage(null);
    setSaveError(null);

    if (!selectedClient) {
      setSaveError("Please select a client first.");
      return;
    }

    if (!selectedJob) {
      setSaveError("Please select a deal for this estimate.");
      return;
    }

    setSaveLoading(true);
    try {
      const payload = {
        title,
        customerId: selectedClient.id,
        customerName: selectedClient.displayName,
        customerPipedriveId: selectedClient.pipedriveId,
        jobId: selectedJob.id,
        dealId: selectedJob.dealId,
        dealName: selectedJob.dealName,
        address: selectedJob.address,
        contractor: inferredContractor,
        date,
        salesRep,
        selectedOptions,
        sourceEstimateNumber,
        ledStripRows: ledStripRows.map((row) => ({
          roomId: row.roomId || null,
          linearFeet: row.linearFeet ? Number(row.linearFeet) : null,
          ledTypeId: row.ledTypeId || null,
          controlTypeId: row.controlTypeId || null,
          profileId: row.profileId || null,
          profileQty: getComputedProfileQty(row),
          subtotal: getRowSubtotal(row),
        })),
        ledSheetRows: ledSheetRows.map((row) => ({
          roomId: row.roomId || null,
          width: row.width ? Number(row.width) : null,
          height: row.height ? Number(row.height) : null,
          squareFeet: getLedSheetSquareFeet(row),
          sheetTypeId: row.sheetTypeId || null,
          controlTypeId: row.controlTypeId || null,
          subtotal: getLedSheetRowSubtotal(row),
        })),
        glassDoorShelfRows: glassDoorShelfRows.map((row) => ({
          width: row.width ? Number(row.width) : null,
          height: row.height ? Number(row.height) : null,
          squareFeet: getGlassDoorShelfSquareFeet(row),
          glassTypeId: row.glassTypeId || null,
          quantity: row.quantity ? Number(row.quantity) : 0,
          note: row.note || null,
          subtotal: getGlassDoorShelfRowSubtotal(row),
        })),
        islandPanelRows: islandPanelRows.map((row) => ({
          roomId: row.roomId || null,
          width: row.width ? Number(row.width) : null,
          height: row.height ? Number(row.height) : null,
          squareFeet: getIslandPanelSquareFeet(row),
          panelModelId: row.panelModelId || null,
          boxQty: getIslandPanelBoxQty(row),
          subtotal: getIslandPanelRowSubtotal(row),
        })),
        wallUnitRows: wallUnitRows.map((row) => ({
          roomId: row.roomId || null,
          width: row.width ? Number(row.width) : null,
          height: row.height ? Number(row.height) : null,
          squareFeet: getWallUnitSquareFeet(row),
          note: row.note || null,
          subtotal: getWallUnitRowSubtotal(row),
        })),
        mirrorFrameRows: mirrorFrameRows.map((row) => ({
          roomId: row.roomId || null,
          width: row.width ? Number(row.width) : null,
          height: row.height ? Number(row.height) : null,
          linearInches: getMirrorFrameLinearInches(row),
          finishId: row.finishId || null,
          painted: row.painted === "YES",
          color: row.color || null,
          subtotal: getMirrorFrameRowSubtotal(row),
        })),
        mirrorRows: mirrorRows.map((row) => ({
          roomId: row.roomId || null,
          width: row.width ? Number(row.width) : null,
          height: row.height ? Number(row.height) : null,
          squareFeet: getMirrorSquareFeet(row),
          outlets: row.outlets ? Number(row.outlets) : 0,
          lightCutout: row.lightCutout ? Number(row.lightCutout) : 0,
          beveledOptionId: row.beveledOptionId || null,
          beveled: isChargeableMirrorBevelOption(
            mirrorBevelById.get(row.beveledOptionId),
          ),
          colorId: row.colorId || null,
          note: row.note || null,
          subtotal: getMirrorRowSubtotal(row),
        })),
        mirrorRemovalRows: mirrorRemovalRows.map((row) => ({
          width: row.width ? Number(row.width) : null,
          height: row.height ? Number(row.height) : null,
          squareFeet: getMirrorRemovalSquareFeet(row),
          repairWall: row.repairWall === "YES",
          note: row.note || null,
          subtotal: getMirrorRemovalSubtotal(row),
          repairWallSubtotal: getMirrorRepairWallSubtotal(row),
          total: getMirrorRemovalTotal(row),
        })),
        ledStripSubtotal,
        ledSheetSubtotal,
        glassDoorShelfSubtotal,
        islandPanelSubtotal,
        wallUnitSubtotal,
        mirrorFrameSubtotal,
        mirrorSubtotal,
        mirrorRemovalSubtotal,
      };

      const response = await fetch("/api/misc-estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Failed to save estimate");
      }

      setEstimateNumber(String(json.estimateNumber || ""));
      setSaveMessage("Estimate saved successfully.");
    } catch (error: any) {
      setSaveError(error?.message || "Failed to save estimate");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div
      id="print-area"
      className="misc-estimate-print misc-estimate-print-container space-y-6 print:space-y-1"
    >
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Miscellaneous Estimate
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          {!isReadOnlyMode && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                type="button"
                onClick={saveEstimate}
                disabled={saveLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
              >
                {saveLoading ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Estimate
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <fieldset
        disabled={isReadOnlyMode}
        className={isReadOnlyMode ? "misc-readonly-content" : undefined}
      >
        <section className="misc-print-block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 print:border print:border-gray-900 print:rounded-none print:p-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:grid-cols-12 print:gap-2 items-stretch">
            <div className="lg:col-span-7 print:col-span-8 border border-gray-300 dark:border-gray-600 rounded-lg p-4 print:border-gray-900 print:p-2">
              <div className="flex gap-4 items-stretch min-h-[118px]">
                <div className="w-48 h-auto relative bg-white rounded border border-gray-200 overflow-hidden flex-shrink-0">
                  <Image
                    src={initialCompanyInfo.logoUrl || "/logo.svg"}
                    alt={initialCompanyInfo.companyName}
                    fill
                    className="object-contain p-2"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {initialCompanyInfo.companyName}
                  </p>
                  {initialCompanyInfo.phoneNumber && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {initialCompanyInfo.phoneNumber}
                    </p>
                  )}
                  {initialCompanyInfo.email && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {initialCompanyInfo.email}
                    </p>
                  )}
                  {initialCompanyInfo.website && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {initialCompanyInfo.website}
                    </p>
                  )}
                  {initialCompanyInfo.address && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      {initialCompanyInfo.address}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 print:col-span-4 border border-gray-300 dark:border-gray-600 rounded-lg p-4 print:border-gray-900 print:p-2 space-y-3 print:space-y-2">
              <div className="grid grid-cols-2 gap-3 print:hidden">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Estimate #
                  </label>
                  <input
                    value={estimateNumber}
                    readOnly
                    placeholder="Generated after Save"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Sales Rep
                </label>
                <input
                  value={salesRep}
                  onChange={(event) => setSalesRep(event.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="hidden print:block space-y-1 text-sm text-gray-900">
                <p>
                  <span className="font-semibold">Estimate #:</span>{" "}
                  {estimateNumber || "Generated after Save"}
                </p>
                <p>
                  <span className="font-semibold">Date:</span> {date || "-"}
                </p>
                <p>
                  <span className="font-semibold">Sales Rep:</span>{" "}
                  {salesRep || "-"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Client search in its own section so the dropdown is never clipped by a parent card */}
        <section className="misc-print-block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 print:border print:border-gray-900 print:rounded-none print:p-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:hidden">
            <div className="lg:col-span-8 print:col-span-4 space-y-3 print:space-y-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="relative">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Client (PD ID, Name, Deal, Address, Contractor)
                </label>
                <input
                  ref={clientInputRef}
                  value={clientSearch}
                  onChange={(event) => searchClients(event.target.value)}
                  placeholder="Type client name, PD ID, deal name or deal ID"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                />
                {loadingClientSearch && (
                  <p className="text-xs text-gray-500 mt-1">Searching...</p>
                )}
                {clientResults.length > 0 && dropdownRect && (
                  <div
                    style={{
                      position: "fixed",
                      top: dropdownRect.top + 4,
                      left: dropdownRect.left,
                      width: dropdownRect.width,
                      zIndex: 9999,
                    }}
                    className="misc-print-hide bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl max-h-72 overflow-auto"
                  >
                    {clientResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handlePickClient(client)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {client.displayName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          PD: {client.pipedriveId || "-"} · Deals:{" "}
                          {client.jobs.length}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedClient && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-gray-300 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-900/40 print:hidden">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Client PD ID
                    </p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {selectedClient.pipedriveId || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Client Name
                    </p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {selectedClient.displayName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Deal ID & Name
                    </p>
                    <select
                      value={selectedJobId}
                      onChange={(event) => setSelectedJobId(event.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    >
                      {selectedClient.jobs.length === 0 && (
                        <option value="">No deals found</option>
                      )}
                      {selectedClient.jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.dealId || "-"} ·{" "}
                          {job.dealName || "Untitled deal"} · {job.status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Address
                    </p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {selectedJob?.address ||
                        selectedClient.customerAddress ||
                        "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Contractor
                    </p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {inferredContractor || "-"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden print:block print:col-span-4 border border-gray-900 rounded-none p-2 bg-white">
              <p className="text-sm font-semibold text-gray-900 mb-2">
                Client Info
              </p>
              <div className="space-y-1.5 text-sm text-gray-900">
                <p>
                  <span className="font-semibold">Client PD ID:</span>{" "}
                  {selectedClient?.pipedriveId || "-"}
                </p>
                <p>
                  <span className="font-semibold">Client Name:</span>{" "}
                  {selectedClient?.displayName || "-"}
                </p>
                <p>
                  <span className="font-semibold">Deal:</span>{" "}
                  {selectedJob?.dealId || "-"} - {selectedJob?.dealName || "-"}{" "}
                  ({selectedJob?.status || "-"})
                </p>
                <p>
                  <span className="font-semibold">Address:</span>{" "}
                  {selectedJob?.address ||
                    selectedClient?.customerAddress ||
                    "-"}
                </p>
                <p>
                  <span className="font-semibold">Contractor:</span>{" "}
                  {inferredContractor || "-"}
                </p>
              </div>
            </div>

            <div className="lg:col-span-4 print:col-span-4 border border-gray-300 dark:border-gray-600 rounded-lg p-3 print:border-gray-900 print:p-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Estimate Sections
              </p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                {OPTION_LABELS.map((item) => (
                  <label
                    key={item.key}
                    className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(item.key)}
                      onChange={() => toggleOption(item.key)}
                      className="rounded border-gray-400"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden print:grid print:grid-cols-3 print:gap-2">
            <div className="border border-gray-900 p-2 bg-white">
              <p className="text-sm font-semibold text-gray-900 mb-1">Title</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                {title || "-"}
              </p>
            </div>

            <div className="border border-gray-900 p-2 bg-white">
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Client Info
              </p>
              <div className="space-y-1 text-sm text-gray-900">
                <p>
                  <span className="font-semibold">Client PD ID:</span>{" "}
                  {selectedClient?.pipedriveId || "-"}
                </p>
                <p>
                  <span className="font-semibold">Client Name:</span>{" "}
                  {selectedClient?.displayName || "-"}
                </p>
                <p>
                  <span className="font-semibold">Deal:</span>{" "}
                  {selectedJob?.dealId || "-"} - {selectedJob?.dealName || "-"}
                </p>
                <p>
                  <span className="font-semibold">Address:</span>{" "}
                  {selectedJob?.address ||
                    selectedClient?.customerAddress ||
                    "-"}
                </p>
                <p>
                  <span className="font-semibold">Contractor:</span>{" "}
                  {inferredContractor || "-"}
                </p>
              </div>
            </div>

            <div className="border border-gray-900 p-2 bg-white">
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Estimate Sections
              </p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm text-gray-900">
                {OPTION_LABELS.map((item) => (
                  <p key={`print-${item.key}`}>
                    {selectedOptions.includes(item.key) ? "[x]" : "[ ]"}{" "}
                    {item.label}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {(saveMessage || saveError) && (
            <div className="mt-4 print:hidden">
              {saveMessage && (
                <p className="text-sm text-green-700 dark:text-green-300 inline-flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  {saveMessage}
                </p>
              )}
              {saveError && (
                <p className="text-sm text-red-600 dark:text-red-300">
                  {saveError}
                </p>
              )}
            </div>
          )}
        </section>

        {selectedOptions.includes("LED_STRIP") && (
          <section className="misc-print-block misc-print-flow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden print:border print:border-gray-900 print:rounded-none">
            <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-3">
              <span>LED STRIP</span>
              <button
                type="button"
                onClick={copyLedStrip}
                className="misc-print-hide inline-flex items-center gap-1.5 rounded bg-white/20 px-2.5 py-1 text-xs font-medium hover:bg-white/30"
              >
                {copiedSection === "LED_STRIP" ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3 h-3" />
                    Copy to Qbooks
                  </>
                )}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse print:min-w-0">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-900">
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center text-xs font-semibold w-10 print:hidden">
                      Del
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Room
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Ln.Ft.
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      LED Type
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Control Type
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Profile
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Profile Qty
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledStripRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border border-gray-300 dark:border-gray-700 p-1 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => removeLedStripRow(row.id)}
                          disabled={ledStripRows.length <= 1}
                          title="Delete row"
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.roomId}
                          onChange={(event) =>
                            updateLedStripRow(row.id, {
                              roomId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select room</option>
                          {rooms.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.linearFeet}
                          onChange={(event) =>
                            updateLedStripRow(row.id, {
                              linearFeet: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.ledTypeId}
                          onChange={(event) =>
                            updateLedStripRow(row.id, {
                              ledTypeId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select LED type</option>
                          {ledTypes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.controlTypeId}
                          onChange={(event) =>
                            updateLedStripRow(row.id, {
                              controlTypeId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select control type</option>
                          {controlTypes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.profileId}
                          onChange={(event) =>
                            updateLedStripRow(row.id, {
                              profileId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select profile</option>
                          {profiles.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          readOnly
                          value={getComputedProfileQty(row)}
                          className="w-full bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <div className="w-full px-2 py-1 text-sm text-right">
                          <RollingCurrency value={getRowSubtotal(row)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 p-2 print:hidden" />
                    <td className="border border-gray-300 dark:border-gray-700 p-2">
                      <button
                        type="button"
                        onClick={addLedStripRow}
                        className="misc-print-hide inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 font-semibold hover:underline"
                      >
                        <Plus className="w-3 h-3" />
                        Add Row
                      </button>
                    </td>
                    <td
                      className="border border-gray-300 dark:border-gray-700 p-2"
                      colSpan={5}
                    />
                    <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right font-semibold text-sm">
                      <RollingCurrency
                        value={ledStripSubtotal}
                        withDollarSign
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedOptions.includes("LED_SHEET") && (
          <section className="misc-print-block misc-print-flow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden print:border print:border-gray-900 print:rounded-none">
            <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-3">
              <span>LED SHEET</span>
              <button
                type="button"
                onClick={copyLedSheet}
                className="misc-print-hide inline-flex items-center gap-1.5 rounded bg-white/20 px-2.5 py-1 text-xs font-medium hover:bg-white/30"
              >
                {copiedSection === "LED_SHEET" ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3 h-3" />
                    Copy to Qbooks
                  </>
                )}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse print:min-w-0">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-900">
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center text-xs font-semibold w-10 print:hidden">
                      Del
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Room
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Width
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Height
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Sq.Ft.
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Sheet Type
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Control Type
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledSheetRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border border-gray-300 dark:border-gray-700 p-1 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => removeLedSheetRow(row.id)}
                          disabled={ledSheetRows.length <= 1}
                          title="Delete row"
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.roomId}
                          onChange={(event) =>
                            updateLedSheetRow(row.id, {
                              roomId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select room</option>
                          {rooms.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.width}
                          onChange={(event) =>
                            updateLedSheetRow(row.id, {
                              width: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.height}
                          onChange={(event) =>
                            updateLedSheetRow(row.id, {
                              height: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          readOnly
                          value={getLedSheetSquareFeet(row)}
                          className="w-full bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.sheetTypeId}
                          onChange={(event) =>
                            updateLedSheetRow(row.id, {
                              sheetTypeId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select sheet type</option>
                          {sheetTypes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.controlTypeId}
                          onChange={(event) =>
                            updateLedSheetRow(row.id, {
                              controlTypeId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select control type</option>
                          {controlTypes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <div className="w-full px-2 py-1 text-sm text-right">
                          <RollingCurrency
                            value={getLedSheetRowSubtotal(row)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 p-2 print:hidden" />
                    <td className="border border-gray-300 dark:border-gray-700 p-2">
                      <button
                        type="button"
                        onClick={addLedSheetRow}
                        className="misc-print-hide inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 font-semibold hover:underline"
                      >
                        <Plus className="w-3 h-3" />
                        Add Row
                      </button>
                    </td>
                    <td
                      className="border border-gray-300 dark:border-gray-700 p-2"
                      colSpan={5}
                    />
                    <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right font-semibold text-sm">
                      <RollingCurrency
                        value={ledSheetSubtotal}
                        withDollarSign
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedOptions.includes("GLASS_DOOR_SHELF") && (
          <section className="misc-print-block misc-print-flow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden print:border print:border-gray-900 print:rounded-none">
            <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-3">
              <span>GLASS DOOR/SHELF</span>
              <button
                type="button"
                onClick={copyGlassDoorShelf}
                className="misc-print-hide inline-flex items-center gap-1.5 rounded bg-white/20 px-2.5 py-1 text-xs font-medium hover:bg-white/30"
              >
                {copiedSection === "GLASS_DOOR_SHELF" ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3 h-3" />
                    Copy to Qbooks
                  </>
                )}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="misc-table-glass w-full min-w-[1060px] table-fixed border-collapse print:min-w-0">
                <colgroup>
                  <col className="misc-col-width" />
                  <col className="misc-col-height" />
                  <col className="misc-col-sqft" />
                  <col className="misc-col-glass-type" />
                  <col className="misc-col-qty" />
                  <col className="misc-col-note" />
                  <col className="misc-col-subtotal" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-900">
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center text-xs font-semibold w-10 print:hidden">
                      Del
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-28">
                      Width
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-28">
                      Height
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-28">
                      Sq.Ft.
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-72">
                      Glass Type
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-28">
                      Quantity
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-64">
                      Note
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-32">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {glassDoorShelfRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border border-gray-300 dark:border-gray-700 p-1 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => removeGlassDoorShelfRow(row.id)}
                          disabled={glassDoorShelfRows.length <= 1}
                          title="Delete row"
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.width}
                          onChange={(event) =>
                            updateGlassDoorShelfRow(row.id, {
                              width: event.target.value,
                            })
                          }
                          className={interactiveCompactFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.height}
                          onChange={(event) =>
                            updateGlassDoorShelfRow(row.id, {
                              height: event.target.value,
                            })
                          }
                          className={interactiveCompactFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          readOnly
                          value={Number(
                            getGlassDoorShelfSquareFeet(row).toFixed(2),
                          )}
                          className="w-24 bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.glassTypeId}
                          onChange={(event) =>
                            updateGlassDoorShelfRow(row.id, {
                              glassTypeId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select glass type</option>
                          {glassDoorShelfTypes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity}
                          onChange={(event) =>
                            updateGlassDoorShelfRow(row.id, {
                              quantity: event.target.value,
                            })
                          }
                          className={`${interactiveCompactFieldClass} w-20 text-center`}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <textarea
                          value={row.note}
                          onChange={(event) =>
                            updateGlassDoorShelfRow(row.id, {
                              note: event.target.value,
                            })
                          }
                          onInput={(event) =>
                            autoGrowTextarea(event.currentTarget)
                          }
                          rows={1}
                          className={`${interactiveTextareaClass} block h-8 min-h-8 print:hidden`}
                        />
                        <div className="hidden print:block whitespace-pre-wrap break-words px-1 py-0.5 text-[8pt] leading-tight">
                          {row.note || "-"}
                        </div>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <div className="w-full px-2 py-1 text-sm text-right">
                          <RollingCurrency
                            value={getGlassDoorShelfRowSubtotal(row)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 p-2 print:hidden" />
                    <td className="border border-gray-300 dark:border-gray-700 p-2">
                      <button
                        type="button"
                        onClick={addGlassDoorShelfRow}
                        className="misc-print-hide inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 font-semibold hover:underline"
                      >
                        <Plus className="w-3 h-3" />
                        Add Row
                      </button>
                    </td>
                    <td
                      className="border border-gray-300 dark:border-gray-700 p-2"
                      colSpan={5}
                    />
                    <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right font-semibold text-sm">
                      <RollingCurrency
                        value={glassDoorShelfSubtotal}
                        withDollarSign
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedOptions.includes("ISLAND_PANEL") && (
          <section className="misc-print-block misc-print-flow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden print:border print:border-gray-900 print:rounded-none">
            <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-3">
              <span>
                ISLAND / WALL DECORATIVE PANEL - Installation Included
              </span>
              <button
                type="button"
                onClick={copyIslandPanel}
                className="misc-print-hide inline-flex items-center gap-1.5 rounded bg-white/20 px-2.5 py-1 text-xs font-medium hover:bg-white/30"
              >
                {copiedSection === "ISLAND_PANEL" ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3 h-3" />
                    Copy to Qbooks
                  </>
                )}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="misc-table-island w-full min-w-[1120px] border-collapse print:min-w-0">
                <colgroup>
                  <col className="misc-col-room" />
                  <col className="misc-col-width" />
                  <col className="misc-col-height" />
                  <col className="misc-col-sqft" />
                  <col className="misc-col-panel-model" />
                  <col className="misc-col-box-qty" />
                  <col className="misc-col-subtotal" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-900">
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center text-xs font-semibold w-10 print:hidden">
                      Del
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Room
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Width
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Height
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Sq.Ft.
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Panel Model
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Box Qty
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {islandPanelRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border border-gray-300 dark:border-gray-700 p-1 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => removeIslandPanelRow(row.id)}
                          disabled={islandPanelRows.length <= 1}
                          title="Delete row"
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.roomId}
                          onChange={(event) =>
                            updateIslandPanelRow(row.id, {
                              roomId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select room</option>
                          {rooms.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.width}
                          onChange={(event) =>
                            updateIslandPanelRow(row.id, {
                              width: event.target.value,
                            })
                          }
                          className={interactiveCompactFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.height}
                          onChange={(event) =>
                            updateIslandPanelRow(row.id, {
                              height: event.target.value,
                            })
                          }
                          className={interactiveCompactFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          readOnly
                          value={Math.round(getIslandPanelSquareFeet(row))}
                          className="w-24 bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.panelModelId}
                          onChange={(event) =>
                            updateIslandPanelRow(row.id, {
                              panelModelId: event.target.value,
                            })
                          }
                          className={`${interactiveFieldClass} print:hidden`}
                        >
                          <option value="">Select panel model</option>
                          {islandPanelModels.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <div className="hidden print:block whitespace-pre-wrap break-words px-1 py-0.5 text-[8pt] leading-tight">
                          {islandPanelModelById.get(row.panelModelId)?.name ||
                            "-"}
                        </div>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          readOnly
                          value={getIslandPanelBoxQty(row)}
                          className="w-24 bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <div className="w-full px-2 py-1 text-sm text-right">
                          <RollingCurrency
                            value={getIslandPanelRowSubtotal(row)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 p-2 print:hidden" />
                    <td className="border border-gray-300 dark:border-gray-700 p-2">
                      <button
                        type="button"
                        onClick={addIslandPanelRow}
                        className="misc-print-hide inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 font-semibold hover:underline"
                      >
                        <Plus className="w-3 h-3" />
                        Add Row
                      </button>
                    </td>
                    <td
                      className="border border-gray-300 dark:border-gray-700 p-2"
                      colSpan={5}
                    />
                    <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right font-semibold text-sm">
                      <RollingCurrency
                        value={islandPanelSubtotal}
                        withDollarSign
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedOptions.includes("WALL_UNIT") && (
          <section className="misc-print-block misc-print-flow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden print:border print:border-gray-900 print:rounded-none">
            <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-3">
              <span>WALL UNIT (Construction)</span>
              <button
                type="button"
                onClick={copyWallUnit}
                className="misc-print-hide inline-flex items-center gap-1.5 rounded bg-white/20 px-2.5 py-1 text-xs font-medium hover:bg-white/30"
              >
                {copiedSection === "WALL_UNIT" ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3 h-3" />
                    Copy to Qbooks
                  </>
                )}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="misc-table-wall w-full min-w-[1040px] border-collapse print:min-w-0">
                <colgroup>
                  <col className="misc-col-room" />
                  <col className="misc-col-width" />
                  <col className="misc-col-height" />
                  <col className="misc-col-sqft" />
                  <col className="misc-col-notes" />
                  <col className="misc-col-subtotal" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-900">
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center text-xs font-semibold w-10 print:hidden">
                      Del
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Room
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Width
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Height
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Sq.Ft.
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Notes
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {wallUnitRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border border-gray-300 dark:border-gray-700 p-1 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => removeWallUnitRow(row.id)}
                          disabled={wallUnitRows.length <= 1}
                          title="Delete row"
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.roomId}
                          onChange={(event) =>
                            updateWallUnitRow(row.id, {
                              roomId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select room</option>
                          {rooms.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.width}
                          onChange={(event) =>
                            updateWallUnitRow(row.id, {
                              width: event.target.value,
                            })
                          }
                          className={interactiveCompactFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.height}
                          onChange={(event) =>
                            updateWallUnitRow(row.id, {
                              height: event.target.value,
                            })
                          }
                          className={interactiveCompactFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          readOnly
                          value={Math.ceil(getWallUnitSquareFeet(row))}
                          className="w-24 bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <textarea
                          value={row.note}
                          onChange={(event) =>
                            updateWallUnitRow(row.id, {
                              note: event.target.value,
                            })
                          }
                          onInput={(event) =>
                            autoGrowTextarea(event.currentTarget)
                          }
                          rows={1}
                          className={`${interactiveTextareaClass} print:hidden`}
                        />
                        <div className="hidden print:block whitespace-pre-wrap break-words px-1 py-0.5 text-[8pt] leading-tight">
                          {row.note || "-"}
                        </div>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <div className="w-full px-2 py-1 text-sm text-right">
                          <RollingCurrency
                            value={getWallUnitRowSubtotal(row)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 p-2 print:hidden" />
                    <td className="border border-gray-300 dark:border-gray-700 p-2">
                      <button
                        type="button"
                        onClick={addWallUnitRow}
                        className="misc-print-hide inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 font-semibold hover:underline"
                      >
                        <Plus className="w-3 h-3" />
                        Add Row
                      </button>
                    </td>
                    <td
                      className="border border-gray-300 dark:border-gray-700 p-2"
                      colSpan={4}
                    />
                    <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right font-semibold text-sm">
                      <RollingCurrency
                        value={wallUnitSubtotal}
                        withDollarSign
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedOptions.includes("MIRROR_FRAME") && (
          <section className="misc-print-block misc-print-flow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden print:border print:border-gray-900 print:rounded-none">
            <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-3">
              <span>MIRROR FRAME - Labor Only</span>
              <button
                type="button"
                onClick={copyMirrorFrame}
                className="misc-print-hide inline-flex items-center gap-1.5 rounded bg-white/20 px-2.5 py-1 text-xs font-medium hover:bg-white/30"
              >
                {copiedSection === "MIRROR_FRAME" ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3 h-3" />
                    Copy to Qbooks
                  </>
                )}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="misc-table-mirror-frame w-full min-w-[1120px] border-collapse print:min-w-0">
                <colgroup>
                  <col className="misc-col-room" />
                  <col className="misc-col-width" />
                  <col className="misc-col-height" />
                  <col className="misc-col-lnin" />
                  <col className="misc-col-type" />
                  <col className="misc-col-painted" />
                  <col className="misc-col-color" />
                  <col className="misc-col-subtotal" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-900">
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center text-xs font-semibold w-10 print:hidden">
                      Del
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Room
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Width
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Height
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Ln.In.
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Type
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Painted
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Color
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mirrorFrameRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border border-gray-300 dark:border-gray-700 p-1 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => removeMirrorFrameRow(row.id)}
                          disabled={mirrorFrameRows.length <= 1}
                          title="Delete row"
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.roomId}
                          onChange={(event) =>
                            updateMirrorFrameRow(row.id, {
                              roomId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select room</option>
                          {rooms.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.width}
                          onChange={(event) =>
                            updateMirrorFrameRow(row.id, {
                              width: event.target.value,
                            })
                          }
                          className={interactiveCompactFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.height}
                          onChange={(event) =>
                            updateMirrorFrameRow(row.id, {
                              height: event.target.value,
                            })
                          }
                          className={interactiveCompactFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          type="number"
                          readOnly
                          value={Number(
                            getMirrorFrameLinearInches(row).toFixed(2),
                          )}
                          className="w-24 bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.finishId}
                          onChange={(event) =>
                            updateMirrorFrameRow(row.id, {
                              finishId: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="">Select type</option>
                          {mirrorFrameFinishes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <select
                          value={row.painted}
                          onChange={(event) =>
                            updateMirrorFrameRow(row.id, {
                              painted: event.target.value as "YES" | "NO",
                            })
                          }
                          className={interactiveFieldClass}
                        >
                          <option value="YES">Yes</option>
                          <option value="NO">No</option>
                        </select>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <input
                          value={row.color}
                          onChange={(event) =>
                            updateMirrorFrameRow(row.id, {
                              color: event.target.value,
                            })
                          }
                          className={interactiveFieldClass}
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 p-1">
                        <div className="w-full px-2 py-1 text-sm text-right">
                          <RollingCurrency
                            value={getMirrorFrameRowSubtotal(row)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 p-2 print:hidden" />
                    <td className="border border-gray-300 dark:border-gray-700 p-2">
                      <button
                        type="button"
                        onClick={addMirrorFrameRow}
                        className="misc-print-hide inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 font-semibold hover:underline"
                      >
                        <Plus className="w-3 h-3" />
                        Add Row
                      </button>
                    </td>
                    <td
                      className="border border-gray-300 dark:border-gray-700 p-2"
                      colSpan={6}
                    />
                    <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right font-semibold text-sm">
                      <RollingCurrency
                        value={mirrorFrameSubtotal}
                        withDollarSign
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedOptions.includes("MIRROR") && (
          <>
            <section className="misc-print-block misc-print-flow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden print:border print:border-gray-900 print:rounded-none">
              <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-3">
                <span>MIRROR</span>
                <button
                  type="button"
                  onClick={copyMirror}
                  className="misc-print-hide inline-flex items-center gap-1.5 rounded bg-white/20 px-2.5 py-1 text-xs font-medium hover:bg-white/30"
                >
                  {copiedSection === "MIRROR" ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-3 h-3" />
                      Copy to Qbooks
                    </>
                  )}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px] border-collapse print:min-w-0">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-900">
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center text-xs font-semibold w-10 print:hidden">
                        Del
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Room
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Width
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Height
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Sq.Ft.
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Outlets
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Light Cutout
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Beveled
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Color
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Note
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mirrorRows.map((row) => (
                      <tr key={row.id}>
                        <td className="border border-gray-300 dark:border-gray-700 p-1 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => removeMirrorRow(row.id)}
                            disabled={mirrorRows.length <= 1}
                            title="Delete row"
                            className="inline-flex items-center justify-center w-7 h-7 rounded text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <select
                            value={row.roomId}
                            onChange={(event) =>
                              updateMirrorRow(row.id, {
                                roomId: event.target.value,
                              })
                            }
                            className={interactiveFieldClass}
                          >
                            <option value="">Select room</option>
                            {rooms.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.width}
                            onChange={(event) =>
                              updateMirrorRow(row.id, {
                                width: event.target.value,
                              })
                            }
                            className={interactiveCompactFieldClass}
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.height}
                            onChange={(event) =>
                              updateMirrorRow(row.id, {
                                height: event.target.value,
                              })
                            }
                            className={interactiveCompactFieldClass}
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <input
                            type="number"
                            readOnly
                            value={Number(getMirrorSquareFeet(row).toFixed(2))}
                            className="w-24 bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.outlets}
                            onChange={(event) =>
                              updateMirrorRow(row.id, {
                                outlets: event.target.value,
                              })
                            }
                            className={interactiveFieldClass}
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.lightCutout}
                            onChange={(event) =>
                              updateMirrorRow(row.id, {
                                lightCutout: event.target.value,
                              })
                            }
                            className={interactiveFieldClass}
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <select
                            value={row.beveledOptionId}
                            onChange={(event) =>
                              updateMirrorRow(row.id, {
                                beveledOptionId: event.target.value,
                              })
                            }
                            className={interactiveFieldClass}
                          >
                            <option value="">Select beveled option</option>
                            {mirrorBevelOptions.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <select
                            value={row.colorId}
                            onChange={(event) =>
                              updateMirrorRow(row.id, {
                                colorId: event.target.value,
                              })
                            }
                            className={interactiveFieldClass}
                          >
                            <option value="">Select color</option>
                            {mirrorColors.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <textarea
                            value={row.note}
                            onChange={(event) =>
                              updateMirrorRow(row.id, {
                                note: event.target.value,
                              })
                            }
                            onInput={(event) =>
                              autoGrowTextarea(event.currentTarget)
                            }
                            rows={1}
                            className={interactiveTextareaClass}
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <div className="w-full px-2 py-1 text-sm text-right">
                            <RollingCurrency
                              value={getMirrorRowSubtotal(row)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="border border-gray-300 dark:border-gray-700 p-2 print:hidden" />
                      <td className="border border-gray-300 dark:border-gray-700 p-2">
                        <button
                          type="button"
                          onClick={addMirrorRow}
                          className="misc-print-hide inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 font-semibold hover:underline"
                        >
                          <Plus className="w-3 h-3" />
                          Add Row
                        </button>
                      </td>
                      <td
                        className="border border-gray-300 dark:border-gray-700 p-2"
                        colSpan={8}
                      />
                      <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right font-semibold text-sm">
                        <RollingCurrency
                          value={mirrorSubtotal}
                          withDollarSign
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="misc-print-block misc-print-flow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden print:border print:border-gray-900 print:rounded-none">
              <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-3">
                <span>MIRROR REMOVAL</span>
                <button
                  type="button"
                  onClick={copyMirrorRemoval}
                  className="misc-print-hide inline-flex items-center gap-1.5 rounded bg-white/20 px-2.5 py-1 text-xs font-medium hover:bg-white/30"
                >
                  {copiedSection === "MIRROR_REMOVAL" ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-3 h-3" />
                      Copy to Qbooks
                    </>
                  )}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="misc-table-mirror-removal w-full min-w-[920px] border-collapse print:min-w-0">
                  <colgroup>
                    <col className="misc-col-width" />
                    <col className="misc-col-height" />
                    <col className="misc-col-sqft" />
                    <col className="misc-col-repair-wall" />
                    <col className="misc-col-removal" />
                    <col className="misc-col-repair-subtotal" />
                    <col className="misc-col-note" />
                    <col className="misc-col-total" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-900">
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center text-xs font-semibold w-10 print:hidden">
                        Del
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-20">
                        Width
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-20">
                        Height
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-20">
                        Sq.Ft.
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-24">
                        Repair Wall
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-32">
                        Mirror Removal
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-36">
                        Repair Wall Subtotal
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold">
                        Note
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-left text-xs font-semibold w-24">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mirrorRemovalRows.map((row) => (
                      <tr key={row.id}>
                        <td className="border border-gray-300 dark:border-gray-700 p-1 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => removeMirrorRemovalRow(row.id)}
                            disabled={mirrorRemovalRows.length <= 1}
                            title="Delete row"
                            className="inline-flex items-center justify-center w-7 h-7 rounded text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.width}
                            onChange={(event) =>
                              updateMirrorRemovalRow(row.id, {
                                width: event.target.value,
                              })
                            }
                            className={`${interactiveCompactFieldClass} w-16`}
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.height}
                            onChange={(event) =>
                              updateMirrorRemovalRow(row.id, {
                                height: event.target.value,
                              })
                            }
                            className={`${interactiveCompactFieldClass} w-16`}
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <input
                            type="number"
                            readOnly
                            value={Number(
                              getMirrorRemovalSquareFeet(row).toFixed(2),
                            )}
                            className="w-24 bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <select
                            value={row.repairWall}
                            onChange={(event) =>
                              updateMirrorRemovalRow(row.id, {
                                repairWall: event.target.value as
                                  | ""
                                  | "YES"
                                  | "NO",
                              })
                            }
                            className={`${interactiveCompactFieldClass} w-20`}
                          >
                            <option value="">Select</option>
                            <option value="YES">Yes</option>
                            <option value="NO">No</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <div className="w-full px-2 py-1 text-sm text-right">
                            <RollingCurrency
                              value={getMirrorRemovalSubtotal(row)}
                            />
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <div className="w-full px-2 py-1 text-sm text-right">
                            <RollingCurrency
                              value={getMirrorRepairWallSubtotal(row)}
                            />
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <textarea
                            value={row.note}
                            onChange={(event) =>
                              updateMirrorRemovalRow(row.id, {
                                note: event.target.value,
                              })
                            }
                            onInput={(event) =>
                              autoGrowTextarea(event.currentTarget)
                            }
                            rows={1}
                            className={`${interactiveTextareaClass} print:hidden`}
                          />
                          <div className="hidden print:block whitespace-pre-wrap break-words px-1 py-0.5 text-[8pt] leading-tight">
                            {row.note || "-"}
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-700 p-1">
                          <div className="w-full px-2 py-1 text-sm text-right">
                            <RollingCurrency
                              value={getMirrorRemovalTotal(row)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="border border-gray-300 dark:border-gray-700 p-2 print:hidden" />
                      <td className="border border-gray-300 dark:border-gray-700 p-2">
                        <button
                          type="button"
                          onClick={addMirrorRemovalRow}
                          className="misc-print-hide inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 font-semibold hover:underline"
                        >
                          <Plus className="w-3 h-3" />
                          Add Row
                        </button>
                      </td>
                      <td
                        className="border border-gray-300 dark:border-gray-700 p-2"
                        colSpan={6}
                      />
                      <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right font-semibold text-sm">
                        <RollingCurrency
                          value={mirrorRemovalSubtotal}
                          withDollarSign
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <section className="misc-print-block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 print:border print:border-gray-900 print:rounded-none print:p-2">
          <div className="ml-auto w-full max-w-md space-y-2 text-sm">
            {selectedOptions.includes("LED_STRIP") && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">
                  LED Strip
                </span>
                <RollingCurrency value={ledStripSubtotal} withDollarSign />
              </div>
            )}
            {selectedOptions.includes("LED_SHEET") && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">
                  LED Sheet
                </span>
                <RollingCurrency value={ledSheetSubtotal} withDollarSign />
              </div>
            )}
            {selectedOptions.includes("GLASS_DOOR_SHELF") && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">
                  Glass Door/Shelf
                </span>
                <RollingCurrency
                  value={glassDoorShelfSubtotal}
                  withDollarSign
                />
              </div>
            )}
            {selectedOptions.includes("ISLAND_PANEL") && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">
                  Island Panel
                </span>
                <RollingCurrency value={islandPanelSubtotal} withDollarSign />
              </div>
            )}
            {selectedOptions.includes("WALL_UNIT") && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">
                  Wall Unit
                </span>
                <RollingCurrency value={wallUnitSubtotal} withDollarSign />
              </div>
            )}
            {selectedOptions.includes("MIRROR_FRAME") && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">
                  Mirror Frame
                </span>
                <RollingCurrency value={mirrorFrameSubtotal} withDollarSign />
              </div>
            )}
            {selectedOptions.includes("MIRROR") && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">
                    Mirror
                  </span>
                  <RollingCurrency value={mirrorSubtotal} withDollarSign />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">
                    Mirror Removal
                  </span>
                  <RollingCurrency
                    value={mirrorRemovalSubtotal}
                    withDollarSign
                  />
                </div>
              </>
            )}

            <div className="border-t border-gray-300 dark:border-gray-600 pt-2 flex items-center justify-between">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Estimate Total
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                <RollingCurrency value={estimateTotal} withDollarSign />
              </span>
            </div>
          </div>
        </section>
      </fieldset>

      <style jsx global>{`
        .misc-estimate-print .misc-readonly-content,
        .misc-estimate-print .misc-readonly-content :disabled {
          opacity: 1;
          cursor: default;
        }

        .misc-estimate-print input[type="number"]::-webkit-outer-spin-button,
        .misc-estimate-print input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .misc-estimate-print input[type="number"] {
          -moz-appearance: textfield;
          appearance: textfield;
        }

        @media print {
          @page {
            size: auto;
            margin: 0.38in;
          }

          body > * {
            visibility: hidden !important;
          }

          #print-area,
          #print-area * {
            visibility: visible !important;
          }

          #print-area {
            position: absolute;
            left: 0;
            top: 0;
          }

          .misc-estimate-print-container {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .misc-estimate-print {
            font-size: 9pt !important;
            line-height: 1.25 !important;
            color: #111 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .misc-estimate-print .misc-print-block {
            break-inside: auto !important;
            page-break-inside: auto !important;
            margin-bottom: 6px !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          .misc-estimate-print .overflow-x-auto {
            overflow: visible !important;
          }

          .misc-estimate-print .misc-print-hide,
          .misc-estimate-print .print\\:hidden {
            display: none !important;
          }

          .misc-estimate-print table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 8pt !important;
          }

          .misc-estimate-print thead {
            display: table-header-group;
          }

          .misc-estimate-print tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .misc-estimate-print th,
          .misc-estimate-print td {
            padding: 2px 3px !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            vertical-align: top !important;
            border-color: #6b7280 !important;
            line-height: 1.2 !important;
          }

          .misc-estimate-print th {
            background: #4b5563 !important;
            color: #fff !important;
            font-weight: 600 !important;
          }

          .misc-estimate-print .bg-blue-600 {
            background: #4b5563 !important;
            color: #fff !important;
          }

          .misc-estimate-print input,
          .misc-estimate-print select,
          .misc-estimate-print textarea {
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
            background: #fff !important;
            border: 1px solid #9ca3af !important;
            box-shadow: none !important;
            color: #111 !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
            padding: 1px 2px !important;
            height: auto !important;
            min-height: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
          }

          .misc-estimate-print textarea {
            height: auto !important;
            min-height: 18px !important;
          }

          .misc-estimate-print select {
            white-space: normal !important;
            word-break: break-word !important;
            text-overflow: clip !important;
          }

          .misc-estimate-print textarea {
            resize: none !important;
          }

          .misc-estimate-print .misc-table-glass .misc-col-width {
            width: 9%;
          }
          .misc-estimate-print .misc-table-glass .misc-col-height {
            width: 9%;
          }
          .misc-estimate-print .misc-table-glass .misc-col-sqft {
            width: 8%;
          }
          .misc-estimate-print .misc-table-glass .misc-col-glass-type {
            width: 22%;
          }
          .misc-estimate-print .misc-table-glass .misc-col-qty {
            width: 8%;
          }
          .misc-estimate-print .misc-table-glass .misc-col-note {
            width: 34%;
          }
          .misc-estimate-print .misc-table-glass .misc-col-subtotal {
            width: 10%;
          }

          .misc-estimate-print .misc-table-island .misc-col-room {
            width: 16%;
          }
          .misc-estimate-print .misc-table-island .misc-col-width {
            width: 8%;
          }
          .misc-estimate-print .misc-table-island .misc-col-height {
            width: 8%;
          }
          .misc-estimate-print .misc-table-island .misc-col-sqft {
            width: 8%;
          }
          .misc-estimate-print .misc-table-island .misc-col-panel-model {
            width: 48%;
          }
          .misc-estimate-print .misc-table-island .misc-col-box-qty {
            width: 8%;
          }
          .misc-estimate-print .misc-table-island .misc-col-subtotal {
            width: 12%;
          }

          .misc-estimate-print .misc-table-wall .misc-col-room {
            width: 18%;
          }
          .misc-estimate-print .misc-table-wall .misc-col-width {
            width: 9%;
          }
          .misc-estimate-print .misc-table-wall .misc-col-height {
            width: 9%;
          }
          .misc-estimate-print .misc-table-wall .misc-col-sqft {
            width: 8%;
          }
          .misc-estimate-print .misc-table-wall .misc-col-notes {
            width: 44%;
          }
          .misc-estimate-print .misc-table-wall .misc-col-subtotal {
            width: 12%;
          }

          .misc-estimate-print .misc-table-mirror-frame .misc-col-room {
            width: 15%;
          }
          .misc-estimate-print .misc-table-mirror-frame .misc-col-width {
            width: 8%;
          }
          .misc-estimate-print .misc-table-mirror-frame .misc-col-height {
            width: 8%;
          }
          .misc-estimate-print .misc-table-mirror-frame .misc-col-lnin {
            width: 8%;
          }
          .misc-estimate-print .misc-table-mirror-frame .misc-col-type {
            width: 20%;
          }
          .misc-estimate-print .misc-table-mirror-frame .misc-col-painted {
            width: 8%;
          }
          .misc-estimate-print .misc-table-mirror-frame .misc-col-color {
            width: 21%;
          }
          .misc-estimate-print .misc-table-mirror-frame .misc-col-subtotal {
            width: 12%;
          }

          .misc-estimate-print .misc-table-mirror-removal .misc-col-width {
            width: 8%;
          }
          .misc-estimate-print .misc-table-mirror-removal .misc-col-height {
            width: 8%;
          }
          .misc-estimate-print .misc-table-mirror-removal .misc-col-sqft {
            width: 8%;
          }
          .misc-estimate-print
            .misc-table-mirror-removal
            .misc-col-repair-wall {
            width: 8%;
          }
          .misc-estimate-print .misc-table-mirror-removal .misc-col-removal {
            width: 12%;
          }
          .misc-estimate-print
            .misc-table-mirror-removal
            .misc-col-repair-subtotal {
            width: 12%;
          }
          .misc-estimate-print .misc-table-mirror-removal .misc-col-note {
            width: 32%;
          }
          .misc-estimate-print .misc-table-mirror-removal .misc-col-total {
            width: 12%;
          }
        }
      `}</style>
    </div>
  );
}
