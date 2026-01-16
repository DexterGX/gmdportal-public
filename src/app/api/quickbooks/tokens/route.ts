import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

/**
 * Save QuickBooks tokens to database
 * This should be run once after obtaining tokens from QuickBooks OAuth
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check - admin only
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { accessToken, refreshToken, expiresIn, realmId } =
      await request.json();

    if (!accessToken || !refreshToken || !realmId) {
      return NextResponse.json(
        {
          error: "Missing required fields: accessToken, refreshToken, realmId",
        },
        { status: 400 }
      );
    }

    // Calculate expiration time (expiresIn is in seconds)
    const expiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000);

    // Delete old tokens and create new one
    await prisma.quickBooksTokens.deleteMany({});

    const tokens = await prisma.quickBooksTokens.create({
      data: {
        accessToken,
        refreshToken,
        expiresAt,
        realmId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Tokens saved successfully",
      expiresAt: tokens.expiresAt,
    });
  } catch (error) {
    console.error("Error saving QuickBooks tokens:", error);
    return NextResponse.json(
      { error: "Failed to save tokens" },
      { status: 500 }
    );
  }
}

/**
 * Get current token status
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check - admin only
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tokens = await prisma.quickBooksTokens.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (!tokens) {
      return NextResponse.json({
        configured: false,
        message: "No tokens found in database",
      });
    }

    const now = new Date();
    const isExpired = tokens.expiresAt <= now;
    const timeUntilExpiry = tokens.expiresAt.getTime() - now.getTime();
    const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
    const minutesUntilExpiry = Math.floor(
      (timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60)
    );

    return NextResponse.json({
      configured: true,
      realmId: tokens.realmId,
      expiresAt: tokens.expiresAt,
      isExpired,
      timeUntilExpiry: isExpired
        ? "Expired"
        : `${hoursUntilExpiry}h ${minutesUntilExpiry}m`,
      lastUpdated: tokens.updatedAt,
    });
  } catch (error) {
    console.error("Error getting token status:", error);
    return NextResponse.json(
      { error: "Failed to get token status" },
      { status: 500 }
    );
  }
}
