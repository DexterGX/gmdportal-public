import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

type QuoteRouteContext = {
  params: Promise<{ jobId: string; quoteId: string }>;
};

// GET /api/closet-jobs/[jobId]/quotes/[quoteId] - Get specific quote
export async function GET(request: NextRequest, context: QuoteRouteContext) {
  try {
    const { jobId, quoteId } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();

    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "sales", "installer"].includes(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const quote = await prisma.closetQuote.findUnique({
      where: { id: quoteId },
      include: {
        closetJob: true,
        files: true,
      },
    });

    if (!quote || quote.closetJobId !== jobId) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// PATCH /api/closet-jobs/[jobId]/quotes/[quoteId] - Update quote (Sales/Admin)
export async function PATCH(request: NextRequest, context: QuoteRouteContext) {
  try {
    const { jobId, quoteId } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();

    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "sales"].includes(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { gmFactor, finalPrice, notesSales, status } = body;

    const quote = await prisma.closetQuote.findUnique({
      where: { id: quoteId },
      include: { closetJob: true },
    });

    if (!quote || quote.closetJobId !== jobId) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (gmFactor !== undefined) updateData.gmFactor = gmFactor;
    if (finalPrice !== undefined) updateData.finalPrice = finalPrice;
    if (notesSales !== undefined) updateData.notesSales = notesSales;
    if (status !== undefined) {
      updateData.status = status;
      if (status === "APPROVED") {
        updateData.approvedAt = new Date();
        updateData.approvedById = user.id;
      }
    }

    const updatedQuote = await prisma.closetQuote.update({
      where: { id: quoteId },
      data: updateData,
    });

    // If quote approved, update job status
    if (status === "APPROVED") {
      await prisma.closetJob.update({
        where: { id: jobId },
        data: { status: "APPROVED" },
      });
    }

    return NextResponse.json(updatedQuote);
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { error: "Failed to update quote" },
      { status: 500 }
    );
  }
}
