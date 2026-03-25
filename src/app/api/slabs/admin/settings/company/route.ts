import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { error: null };
}

async function getOrCreateSettings() {
  const existing = await prismaAny.companyDocumentSettings.findFirst();
  if (existing) return existing;

  return prismaAny.companyDocumentSettings.create({
    data: {
      companyName: "GM Design",
      phoneNumber: "(305) XXX-XXXX",
      logoUrl: "/logo.svg",
    },
  });
}

export async function GET() {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const settings = await getOrCreateSettings();

    return NextResponse.json({
      id: settings.id,
      companyName: settings.companyName,
      phoneNumber: settings.phoneNumber,
      address: settings.address,
      logoUrl: settings.logoUrl,
      updatedAt: settings.updatedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch company document settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const {
      companyName,
      phoneNumber,
      address,
      logoUrl,
    }: {
      companyName?: string;
      phoneNumber?: string | null;
      address?: string | null;
      logoUrl?: string;
    } = body;

    if (companyName !== undefined && !String(companyName).trim()) {
      return NextResponse.json(
        { error: "Company name cannot be empty" },
        { status: 400 },
      );
    }

    const settings = await getOrCreateSettings();

    const updated = await prismaAny.companyDocumentSettings.update({
      where: { id: settings.id },
      data: {
        ...(companyName !== undefined
          ? { companyName: String(companyName).trim() }
          : {}),
        ...(phoneNumber !== undefined
          ? { phoneNumber: phoneNumber ? String(phoneNumber).trim() : null }
          : {}),
        ...(address !== undefined
          ? { address: address ? String(address).trim() : null }
          : {}),
        ...(logoUrl !== undefined ? { logoUrl: String(logoUrl).trim() } : {}),
      },
    });

    return NextResponse.json({
      id: updated.id,
      companyName: updated.companyName,
      phoneNumber: updated.phoneNumber,
      address: updated.address,
      logoUrl: updated.logoUrl,
      updatedAt: updated.updatedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update company document settings" },
      { status: 500 },
    );
  }
}
