import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireUserEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return null;
  }
  return email;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const email = await requireUserEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const normalizedId = id?.trim();
    if (!normalizedId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const estimate = await prismaAny.miscEstimate.findUnique({
      where: { id: normalizedId },
      include: {
        ledRows: {
          include: {
            room: { select: { id: true, name: true } },
            ledType: { select: { id: true, name: true, pricePerFt: true } },
            controlType: { select: { id: true, name: true, unitPrice: true } },
            profile: { select: { id: true, name: true, unitPrice: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        ledSheetRows: {
          include: {
            room: { select: { id: true, name: true } },
            sheetType: { select: { id: true, name: true, unitPrice: true } },
            controlType: { select: { id: true, name: true, unitPrice: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        glassDoorShelfRows: {
          include: {
            glassType: { select: { id: true, name: true, venda: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        islandPanelRows: {
          include: {
            room: { select: { id: true, name: true } },
            panelModel: { select: { id: true, name: true, salesPrice: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        wallUnitRows: {
          include: {
            room: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        mirrorFrameRows: {
          include: {
            room: { select: { id: true, name: true } },
            finish: {
              select: { id: true, name: true, pricePerLinearFt: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        mirrorRows: {
          include: {
            room: { select: { id: true, name: true } },
            color: { select: { id: true, name: true, venda: true } },
            beveledOption: { select: { id: true, name: true, venda: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        mirrorRemovalRows: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!estimate) {
      const artifact = await prisma.jobArtifact.findFirst({
        where: { id: normalizedId, sourceApp: "MISC_ESTIMATE" },
        select: { id: true, title: true, metadata: true, createdAt: true },
      });

      if (!artifact) {
        return NextResponse.json(
          { error: "Estimate not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        id: artifact.id,
        title: artifact.title,
        metadata: artifact.metadata ?? {},
        createdAt: artifact.createdAt,
      });
    }

    const ledRows = estimate.ledRows.map((row: any) => {
      const linearFeet = toNumber(row.linearFeet);
      const profileQty = toNumber(row.profileQty);
      return {
        id: row.id,
        roomId: row.roomId,
        room: row.room?.name ?? "",
        lnFt: linearFeet,
        linearFeet,
        ledTypeId: row.ledTypeId,
        ledType: row.ledType?.name ?? "",
        controlTypeId: row.controlTypeId,
        controlType: row.controlType?.name ?? "",
        profileId: row.profileId,
        profile: row.profile?.name ?? "",
        profileQty,
        subtotal: toNumber(row.subtotal),
      };
    });

    const ledSheetRows = estimate.ledSheetRows.map((row: any) => {
      const width = toNumber(row.widthIn);
      const height = toNumber(row.heightIn);
      const squareFeet = toNumber(row.squareFeet);
      return {
        id: row.id,
        roomId: row.roomId,
        room: row.room?.name ?? "",
        width,
        widthIn: width,
        height,
        heightIn: height,
        squareFeet,
        sqFt: squareFeet,
        sheetTypeId: row.sheetTypeId,
        sheetType: row.sheetType?.name ?? "",
        controlTypeId: row.controlTypeId,
        controlType: row.controlType?.name ?? "",
        subtotal: toNumber(row.subtotal),
      };
    });

    const mirrorRows = estimate.mirrorRows.map((row: any) => {
      const width = toNumber(row.widthIn);
      const height = toNumber(row.heightIn);
      const squareFeet = toNumber(row.squareFeet);
      return {
        id: row.id,
        roomId: row.roomId,
        room: row.room?.name ?? "",
        colorId: row.colorId,
        color: row.color?.name ?? "",
        beveledOptionId: row.beveledOptionId,
        beveledOption: row.beveledOption?.name ?? "",
        width,
        widthIn: width,
        height,
        heightIn: height,
        squareFeet,
        outlets: toNumber(row.outlets),
        lightCutout: toNumber(row.lightCutouts),
        beveled: Boolean(row.beveled),
        note: row.note ?? "",
        subtotal: toNumber(row.subtotal),
      };
    });

    const glassDoorShelfRows = estimate.glassDoorShelfRows.map((row: any) => {
      const width = toNumber(row.widthIn);
      const height = toNumber(row.heightIn);
      const squareFeet = toNumber(row.squareFeet);
      return {
        id: row.id,
        width,
        widthIn: width,
        height,
        heightIn: height,
        squareFeet,
        sqFt: squareFeet,
        glassTypeId: row.glassTypeId,
        glassType: row.glassType?.name ?? "",
        quantity: toNumber(row.quantity),
        note: row.note ?? "",
        subtotal: toNumber(row.subtotal),
      };
    });

    const islandPanelRows = estimate.islandPanelRows.map((row: any) => {
      const width = toNumber(row.widthIn);
      const height = toNumber(row.heightIn);
      const squareFeet = toNumber(row.squareFeet);
      return {
        id: row.id,
        roomId: row.roomId,
        room: row.room?.name ?? "",
        width,
        widthIn: width,
        height,
        heightIn: height,
        squareFeet,
        sqFt: squareFeet,
        panelModelId: row.panelModelId,
        panelModel: row.panelModel?.name ?? "",
        boxQty: toNumber(row.boxQty),
        subtotal: toNumber(row.subtotal),
      };
    });

    const wallUnitRows = estimate.wallUnitRows.map((row: any) => {
      const width = toNumber(row.widthIn);
      const height = toNumber(row.heightIn);
      const squareFeet = toNumber(row.squareFeet);
      return {
        id: row.id,
        roomId: row.roomId,
        room: row.room?.name ?? "",
        width,
        widthIn: width,
        height,
        heightIn: height,
        squareFeet,
        sqFt: squareFeet,
        note: row.note ?? "",
        subtotal: toNumber(row.subtotal),
      };
    });

    const mirrorFrameRows = estimate.mirrorFrameRows.map((row: any) => {
      const width = toNumber(row.widthIn);
      const height = toNumber(row.heightIn);
      const linearInches = toNumber(row.linearInches);
      return {
        id: row.id,
        roomId: row.roomId,
        room: row.room?.name ?? "",
        width,
        widthIn: width,
        height,
        heightIn: height,
        linearInches,
        lnIn: linearInches,
        finishId: row.finishId,
        finish: row.finish?.name ?? "",
        painted: Boolean(row.painted),
        color: row.color ?? "",
        subtotal: toNumber(row.subtotal),
      };
    });

    const mirrorRemovalRows = estimate.mirrorRemovalRows.map((row: any) => {
      const width = toNumber(row.widthIn);
      const height = toNumber(row.heightIn);
      return {
        id: row.id,
        width,
        widthIn: width,
        height,
        heightIn: height,
        squareFeet: toNumber(row.squareFeet),
        repairWall: Boolean(row.repairWall),
        note: row.note ?? "",
        subtotal: toNumber(row.subtotal),
        repairWallSubtotal: toNumber(row.repairWallSubtotal),
        total: toNumber(row.total),
      };
    });

    const ledStripSubtotal = ledRows.reduce(
      (sum: number, row: any) => sum + toNumber(row.subtotal),
      0,
    );
    const ledSheetSubtotal = ledSheetRows.reduce(
      (sum: number, row: any) => sum + toNumber(row.subtotal),
      0,
    );
    const glassDoorShelfSubtotal = glassDoorShelfRows.reduce(
      (sum: number, row: any) => sum + toNumber(row.subtotal),
      0,
    );
    const islandPanelSubtotal = islandPanelRows.reduce(
      (sum: number, row: any) => sum + toNumber(row.subtotal),
      0,
    );
    const wallUnitSubtotal = wallUnitRows.reduce(
      (sum: number, row: any) => sum + toNumber(row.subtotal),
      0,
    );
    const mirrorFrameSubtotal = mirrorFrameRows.reduce(
      (sum: number, row: any) => sum + toNumber(row.subtotal),
      0,
    );
    const mirrorSubtotal = mirrorRows.reduce(
      (sum: number, row: any) => sum + toNumber(row.subtotal),
      0,
    );
    const mirrorRemovalSubtotal = mirrorRemovalRows.reduce(
      (sum: number, row: any) => sum + toNumber(row.total),
      0,
    );
    const selectedOptions: string[] = [];
    if (ledRows.length > 0) {
      selectedOptions.push("LED_STRIP");
    }
    if (ledSheetRows.length > 0) {
      selectedOptions.push("LED_SHEET");
    }
    if (glassDoorShelfRows.length > 0) {
      selectedOptions.push("GLASS_DOOR_SHELF");
    }
    if (islandPanelRows.length > 0) {
      selectedOptions.push("ISLAND_PANEL");
    }
    if (wallUnitRows.length > 0) {
      selectedOptions.push("WALL_UNIT");
    }
    if (mirrorFrameRows.length > 0) {
      selectedOptions.push("MIRROR_FRAME");
    }
    if (mirrorRows.length > 0 || mirrorRemovalRows.length > 0) {
      selectedOptions.push("MIRROR");
    }

    return NextResponse.json({
      id: estimate.id,
      estimateNumber: estimate.estimateNo,
      title: estimate.title,
      metadata: {
        estimateNumber: estimate.estimateNo,
        title: estimate.title,
        customerId: estimate.clientId,
        customerName: estimate.clientName,
        jobId: null,
        dealId: estimate.dealId,
        dealName: estimate.dealName,
        date: estimate.date.toISOString().slice(0, 10),
        salesRep: estimate.salesRep,
        selectedOptions,
        ledStripRows: ledRows,
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
        mirrorSubtotal,
        mirrorRemovalRows,
        mirrorRemovalSubtotal,
      },
      createdAt: estimate.createdAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load estimate" },
      { status: 500 },
    );
  }
}
