import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET_NAME = "closet-quotes";

type QuoteRouteContext = {
  params: Promise<{ jobId: string; quoteId: string }>;
};

// GET /api/closet-jobs/[jobId]/quotes/[quoteId] - Get specific quote
export async function GET(request: NextRequest, context: QuoteRouteContext) {
  try {
    const { jobId, quoteId } = await context.params;
    const { user, appRole, appRoles, canAccess } = await getProgramUserContext("closetJobs");

    if (!user || appRoles.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canAccess) {
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
    const { user, appRole, appRoles } = await getProgramUserContext("closetJobs");

    if (!user || appRoles.length === 0) {
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

// DELETE /api/closet-jobs/[jobId]/quotes/[quoteId] - Delete quote (Installer/Admin)
export async function DELETE(request: NextRequest, context: QuoteRouteContext) {
  try {
    const { jobId, quoteId } = await context.params;
    const { user, appRole, appRoles } = await getProgramUserContext("closetJobs");

    if (!user || appRoles.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (![
      "admin",
      "installer",
    ].includes(appRole)) {
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

    // Installer can only delete own quotes for their assigned jobs.
    if (appRole === "installer") {
      if (quote.closetJob.installerId !== user.id || quote.submittedById !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const storagePaths = quote.files
      .map((file) => {
        const marker = `${BUCKET_NAME}/`;
        const markerIndex = file.fileUrl.indexOf(marker);
        if (markerIndex === -1) {
          return null;
        }
        return file.fileUrl.slice(markerIndex + marker.length);
      })
      .filter((path): path is string => Boolean(path));

    await prisma.closetQuote.delete({ where: { id: quoteId } });

    if (storagePaths.length > 0) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(storagePaths);
    }

    // Recompute job status after quote deletion.
    const remainingQuotes = await prisma.closetQuote.findMany({
      where: { closetJobId: jobId },
      select: { status: true },
    });

    const hasApprovedQuote = remainingQuotes.some(
      (item) => item.status === "APPROVED"
    );
    const hasPendingReviewQuote = remainingQuotes.some(
      (item) => item.status === "PENDING_REVIEW"
    );

    const nextJobStatus = hasApprovedQuote
      ? "APPROVED"
      : hasPendingReviewQuote
      ? "REVIEW"
      : "QUOTE";

    await prisma.closetJob.update({
      where: { id: jobId },
      data: { status: nextJobStatus },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quote:", error);
    return NextResponse.json(
      { error: "Failed to delete quote" },
      { status: 500 }
    );
  }
}
