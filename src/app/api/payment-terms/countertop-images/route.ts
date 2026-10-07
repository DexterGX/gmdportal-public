import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import {
  COUNTERTOP_IMAGE_OPTIONS_BY_CATEGORY,
  normalizeOptionKey,
  type CountertopImageCategory,
} from "@/lib/countertopAgreementOptions";
import { promises as fs } from "fs";
import path from "path";

const prismaAny = prisma as any;

function isValidCategory(value: unknown): value is CountertopImageCategory {
  return value === "sink" || value === "thickness" || value === "edge";
}

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appRole, isActive } = await getProgramUserContext("paymentTerms");
  if (!isActive || appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

function getDefaultLabel(category: CountertopImageCategory, optionKey: string) {
  return (
    COUNTERTOP_IMAGE_OPTIONS_BY_CATEGORY[category].find(
      (entry) => entry.optionKey === optionKey,
    )?.optionLabel || optionKey
  );
}

export async function GET() {
  try {
    const denial = await ensureAdmin();
    if (denial) return denial;

    const rows = await prismaAny.countertopAgreementImage.findMany({
      orderBy: [{ category: "asc" }, { optionLabel: "asc" }],
    });

    return NextResponse.json({
      items: rows,
      optionsByCategory: COUNTERTOP_IMAGE_OPTIONS_BY_CATEGORY,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load countertop images" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const denial = await ensureAdmin();
    if (denial) return denial;

    const body = await request.json();
    const category = body?.category;
    const keyInput = String(body?.optionKey || "");
    const imageUrl =
      body?.imageUrl == null ? null : String(body.imageUrl).trim();

    if (!isValidCategory(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const optionKey = normalizeOptionKey(keyInput);
    if (!optionKey) {
      return NextResponse.json(
        { error: "optionKey is required" },
        { status: 400 },
      );
    }

    const optionLabel =
      String(body?.optionLabel || "").trim() ||
      getDefaultLabel(category, optionKey);

    const row = await prismaAny.countertopAgreementImage.upsert({
      where: {
        category_optionKey: {
          category,
          optionKey,
        },
      },
      update: {
        optionLabel,
        imageUrl,
      },
      create: {
        category,
        optionKey,
        optionLabel,
        imageUrl,
      },
    });

    return NextResponse.json({ item: row });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save countertop image" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const denial = await ensureAdmin();
    if (denial) return denial;

    const body = await request.json();
    const category = body?.category;
    const keyInput = String(body?.optionKey || "");

    if (!isValidCategory(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const optionKey = normalizeOptionKey(keyInput);
    if (!optionKey) {
      return NextResponse.json(
        { error: "optionKey is required" },
        { status: 400 },
      );
    }

    const existing = await prismaAny.countertopAgreementImage.findUnique({
      where: {
        category_optionKey: {
          category,
          optionKey,
        },
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ ok: true });
    }

    if (
      typeof existing.imageUrl === "string" &&
      existing.imageUrl.startsWith("/payment-terms/countertop-images/")
    ) {
      const localPath = path.join(
        process.cwd(),
        "public",
        existing.imageUrl.replace(/^\//, ""),
      );
      await fs.unlink(localPath).catch(() => undefined);
    }

    await prismaAny.countertopAgreementImage.delete({
      where: {
        category_optionKey: {
          category,
          optionKey,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete countertop image" },
      { status: 500 },
    );
  }
}
